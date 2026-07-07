import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, setSessionCookie, verifyPassword } from "./auth.js";
import { autotrace } from "./autotrace.js";
import type { Config } from "./config.js";
import { runCode, type Language } from "./run.js";

const LoginBody = z.object({ password: z.string().min(1).max(200) }).strict();

function makeRunBody(config: Config) {
  return z
    .object({
      language: z.enum(["go", "java", "cpp"]),
      code: z.string().min(1).max(config.MAX_CODE_LENGTH),
      input: z.string().max(config.MAX_INPUT_LENGTH).default(""),
      instrument: z.boolean().default(false), // auto-instrument raw code (Go only)
    })
    .strict(); // reject unknown fields (mass-assignment guard)
}

export function buildApp(config: Config): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.isProd ? "info" : "debug",
      // Never log secrets/PII (CWE-532).
      redact: ["req.headers.cookie", "req.headers.authorization", "req.body.password", "req.body.code"],
    },
    bodyLimit: config.MAX_CODE_LENGTH + config.MAX_INPUT_LENGTH + 4096,
  });

  const RunBody = makeRunBody(config);

  // Generic error handler — log details server-side, return a generic message.
  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    app.log.error({ err }, "unhandled error");
    const status = err.statusCode ?? 500;
    reply.code(status).send({ status: "error", error: status === 429 ? "rate_limited" : "internal_error" });
  });

  // Plugins
  void app.register(cookie, { secret: config.COOKIE_SECRET });
  void app.register(cors, {
    origin: config.CORS_ORIGIN.split(",").map((o) => o.trim()), // strict allow-list, no wildcard
    credentials: true,
  });
  void app.register(rateLimit, { global: false });

  // --- Routes ---------------------------------------------------------------

  app.get("/api/health", async () => ({ status: "ok" }));

  app.post(
    "/api/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const parsed = LoginBody.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ status: "error", error: "invalid_request" });

      if (!verifyPassword(parsed.data.password, config)) {
        // Generic message — do not reveal whether the password was close.
        return reply.code(401).send({ status: "error", error: "invalid_credentials" });
      }
      setSessionCookie(reply, config);
      return reply.send({ status: "ok" });
    },
  );

  // Lightweight session probe — lets the frontend skip the login screen when the
  // HttpOnly cookie from a previous visit is still valid.
  app.get("/api/session", { preHandler: requireAuth }, async () => ({ status: "ok" }));

  // AI auto-trace: rewrite raw pasted code into tracer-instrumented code (Gemini).
  // Output is untrusted — the client reviews it and it only runs in the sandbox.
  app.post(
    "/api/autotrace",
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } }, // LLM quota guard
    },
    async (req, reply) => {
      const Body = z
        .object({
          language: z.literal("go"), // v1: Go only (tracer coverage is deepest there)
          code: z.string().min(1).max(config.MAX_CODE_LENGTH),
        })
        .strict();
      const parsed = Body.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ status: "error", error: "invalid_request" });

      const outcome = await autotrace(parsed.data.code, config);
      if (!outcome.ok) {
        req.log.warn({ reason: outcome.error }, "autotrace failed");
        const message =
          outcome.error === "not_configured"
            ? "AI auto-trace is not configured on this server (missing GEMINI_API_KEY)."
            : outcome.error === "quota_exceeded"
              ? "AI quota exceeded — try again in a minute."
              : "AI auto-trace failed — try again or instrument manually.";
        return reply.send({ status: "error", error: message });
      }
      return reply.send({ status: "ok", ...outcome.result });
    },
  );

  app.post("/api/logout", async (_req, reply) => {
    reply.clearCookie("auth", { path: "/" });
    return reply.send({ status: "ok" });
  });

  app.post(
    "/api/run",
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: config.RUN_RATE_MAX, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const parsed = RunBody.safeParse(req.body);
      if (!parsed.success) {
        req.log.warn({ issues: parsed.error.issues }, "invalid /api/run body");
        return reply.code(400).send({ status: "error", error: "invalid_request" });
      }
      try {
        const result = await runCode(
          parsed.data as { language: Language; code: string; input: string; instrument: boolean },
          config,
        );
        return reply.send(result); // always HTTP 200; status is in the body
      } catch (err) {
        req.log.error({ err }, "run failed");
        return reply.send({ status: "internal_error", events: [], stdout: "", durationMs: 0, error: "internal_error" });
      }
    },
  );

  return app;
}
