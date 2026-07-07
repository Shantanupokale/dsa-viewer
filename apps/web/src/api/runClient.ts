import type { TraceEvent } from "@dsa/trace-schema";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8080";

export type RunStatus =
  | "success"
  | "runtime_error"
  | "compilation_failed"
  | "timeout"
  | "internal_error"
  | "error";

export interface RunResult {
  status: RunStatus;
  events?: TraceEvent[];
  stdout?: string;
  durationMs?: number;
  error?: string;
}

export interface RunRequest {
  language: string;
  code: string;
  input: string;
}

/** POST /api/run. Sends the session cookie (credentials: include). */
export async function runCode(body: RunRequest): Promise<RunResult> {
  const res = await fetch(`${API_BASE}/api/run`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) return { status: "error", error: "unauthorized" };
  return (await res.json()) as RunResult;
}

/** POST /api/login. Returns true on success (server sets the HttpOnly cookie). */
export async function login(password: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return res.ok;
}
