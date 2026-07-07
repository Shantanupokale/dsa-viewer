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
  instrumentedCode?: string;
}

export interface RunRequest {
  language: string;
  code: string;
  input: string;
  instrument?: boolean;
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

export interface AutotraceResponse {
  status: "ok" | "error";
  concept?: string;
  plugin?: string;
  code?: string;
  error?: string;
}

/** POST /api/autotrace — AI rewrite of raw code into tracer-instrumented code. */
export async function autotrace(language: string, code: string): Promise<AutotraceResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/autotrace`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language, code }),
    });
    if (res.status === 401) return { status: "error", error: "unauthorized" };
    return (await res.json()) as AutotraceResponse;
  } catch {
    return { status: "error", error: "Could not reach the server." };
  }
}

/** GET /api/session — true when the cookie from a previous visit is still valid. */
export async function hasSession(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/session`, { credentials: "include" });
    return res.ok;
  } catch {
    return false; // server down / unreachable — show the login gate
  }
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
