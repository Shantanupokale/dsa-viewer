import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Config } from "./config.js";

const COOKIE_NAME = "auth";
const COOKIE_VALUE = "1";
const SESSION_MAX_AGE_S = 60 * 60 * 8; // 8 hours

/**
 * Constant-time password check (CWE-208). Hashing both sides to a fixed-length
 * digest first lets timingSafeEqual run on equal-length buffers regardless of the
 * candidate's length, so length itself doesn't leak.
 */
function passwordMatches(candidate: string, expected: string): boolean {
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Issue the signed, HttpOnly session cookie after a correct password. */
export function setSessionCookie(reply: FastifyReply, config: Config): void {
  reply.setCookie(COOKIE_NAME, COOKIE_VALUE, {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd, // HTTPS-only in production
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
}

export function verifyPassword(candidate: string, config: Config): boolean {
  return passwordMatches(candidate, config.APP_ACCESS_PASSWORD);
}

/** Fastify preHandler that rejects requests without a valid session cookie. */
export function requireAuth(request: FastifyRequest, reply: FastifyReply, done: () => void): void {
  const raw = request.cookies?.[COOKIE_NAME];
  if (!raw) {
    reply.code(401).send({ status: "error", error: "unauthorized" });
    return;
  }
  const unsigned = request.unsignCookie(raw);
  if (!unsigned.valid || unsigned.value !== COOKIE_VALUE) {
    reply.code(401).send({ status: "error", error: "unauthorized" });
    return;
  }
  done();
}
