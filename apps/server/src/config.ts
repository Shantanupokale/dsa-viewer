import { z } from "zod";

/**
 * Environment configuration, validated at startup. Secrets are loaded from the
 * environment only (never hardcoded, never shipped to the client). A missing or
 * weak secret fails the boot rather than starting insecurely.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().min(1).default("0.0.0.0"),

  // Auth (PRD §13)
  APP_ACCESS_PASSWORD: z.string().min(8, "APP_ACCESS_PASSWORD must be at least 8 chars"),
  COOKIE_SECRET: z.string().min(16, "COOKIE_SECRET must be at least 16 chars"),

  // Sandbox limits (PRD §8.2 / §14)
  RUN_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(10_000),
  MAX_CODE_LENGTH: z.coerce.number().int().positive().default(50_000),
  MAX_INPUT_LENGTH: z.coerce.number().int().positive().default(100_000),
  RUN_RATE_MAX: z.coerce.number().int().positive().default(20),

  // Optional: enables POST /api/autotrace (AI rewrite via Gemini). Feature is
  // disabled when absent. Loaded from env only — never shipped to the client.
  GEMINI_API_KEY: z.string().min(10).optional(),

  // Comma-separated allow-list of origins. Both loopback spellings are allowed by
  // default — browsers treat localhost and 127.0.0.1 as different origins.
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:5173,http://127.0.0.1:5173")
    .refine(
      (v) => v.split(",").every((o) => z.string().url().safeParse(o.trim()).success),
      "CORS_ORIGIN must be a comma-separated list of valid URLs",
    ),
});

export type Config = z.infer<typeof EnvSchema> & { isProd: boolean };

/** Parse and validate process.env. Throws a redacted error on failure. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    // Report which vars are wrong WITHOUT echoing their (possibly secret) values.
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${problems}`);
  }
  return { ...parsed.data, isProd: parsed.data.NODE_ENV === "production" };
}
