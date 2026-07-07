import type { TraceEvent } from "@dsa/trace-schema";
import type { Config } from "./config.js";
import { record } from "./recorder.js";
import { runInSandbox } from "./sandbox.js";

/** Discriminated status for POST /api/run (PRD §8.1). */
export type RunStatus =
  | "success"
  | "runtime_error"
  | "compilation_failed"
  | "timeout"
  | "internal_error";

export interface RunResult {
  status: RunStatus;
  events: TraceEvent[];
  stdout: string;
  durationMs: number;
  error?: string;
}

export type Language = "go" | "java" | "cpp";

/** go.mod for the Go job: module `run`, tracer resolved via the image's vendored copy. */
const GO_MOD = "module run\n\ngo 1.22\n\nrequire dsaviz v0.0.0\n\nreplace dsaviz => /opt/dsaviz\n";

interface LangConfig {
  image: string;
  /** filename -> contents written into the read-only job dir mounted at /job */
  files: (code: string, input: string) => Record<string, string>;
}

/** Per-language sandbox config. Fixed map — never derived from user input. */
const LANGS: Partial<Record<Language, LangConfig>> = {
  go: {
    image: "dsa-run-go:0.1.0",
    files: (code, input) => ({ "main.go": code, "go.mod": GO_MOD, "input.txt": input }),
  },
  java: {
    image: "dsa-run-java:0.1.0",
    files: (code, input) => ({ "Main.java": code, "input.txt": input }),
  },
  cpp: {
    image: "dsa-run-cpp:0.1.0",
    files: (code, input) => ({ "main.cpp": code, "input.txt": input }),
  },
};

const COMPILE_FAILED_EXIT = 20; // matches docker/scripts/run.sh
const MAX_ERROR_LENGTH = 10_000;

const MEMORY_BYTES = 256 * 1024 * 1024;
const NANO_CPUS = 500_000_000; // 0.5 CPU
const PIDS_LIMIT = 128;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

export interface RunInput {
  language: Language;
  code: string;
  input: string;
}

/**
 * Compile + run one submission end to end. Always resolves (never throws) with a
 * discriminated status; the route maps every outcome to HTTP 200.
 */
export async function runCode(req: RunInput, config: Config): Promise<RunResult> {
  const lang = LANGS[req.language];
  if (!lang) {
    return {
      status: "internal_error",
      events: [],
      stdout: "",
      durationMs: 0,
      error: `Language "${req.language}" is not supported yet.`,
    };
  }

  const sandbox = await runInSandbox({
    image: lang.image,
    files: lang.files(req.code, req.input),
    timeoutMs: config.RUN_TIMEOUT_MS,
    memoryBytes: MEMORY_BYTES,
    nanoCpus: NANO_CPUS,
    pidsLimit: PIDS_LIMIT,
    maxOutputBytes: MAX_OUTPUT_BYTES,
  });

  const { events, stdout } = record(sandbox.stdout);

  if (sandbox.timedOut) {
    return {
      status: "timeout",
      events,
      stdout,
      durationMs: sandbox.durationMs,
      error: `Execution exceeded the ${config.RUN_TIMEOUT_MS}ms limit and was terminated.`,
    };
  }
  if (sandbox.exitCode === COMPILE_FAILED_EXIT) {
    return {
      status: "compilation_failed",
      events: [],
      stdout: "",
      durationMs: sandbox.durationMs,
      error: cleanCompilerError(sandbox.stderr),
    };
  }
  if (sandbox.exitCode !== 0) {
    // 137 = SIGKILL — with our cgroup limits this is almost always the 256MB memory
    // cap (OOM kill), so say that instead of a bare exit code.
    const fallback =
      sandbox.exitCode === 137
        ? "Program was killed — it likely exceeded the 256MB memory limit."
        : `Program exited with code ${sandbox.exitCode}.`;
    return {
      status: "runtime_error",
      events, // events captured before the crash
      stdout,
      durationMs: sandbox.durationMs,
      error: truncate(sandbox.stderr.trim() || fallback),
    };
  }
  return { status: "success", events, stdout, durationMs: sandbox.durationMs };
}

/** Strip the entrypoint's sentinel line and truncate to a sane length. */
function cleanCompilerError(stderr: string): string {
  const cleaned = stderr
    .split("\n")
    .filter((l) => l.trim() !== "__COMPILE_FAILED__")
    .join("\n")
    .trim();
  return truncate(cleaned || "Compilation failed.");
}

function truncate(s: string): string {
  return s.length > MAX_ERROR_LENGTH ? s.slice(0, MAX_ERROR_LENGTH) + "\n…(truncated)" : s;
}
