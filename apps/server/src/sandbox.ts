import Docker from "dockerode";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";

/**
 * Runs one untrusted program in an ephemeral, locked-down Docker container.
 *
 * The isolation here is the security boundary (PRD §8.2) and MUST NOT be relaxed:
 * no network, hard memory cap with no swap, CPU cap, PID cap, read-only rootfs with
 * a tmpfs scratch, non-root user, all capabilities dropped, no privilege escalation,
 * and a wall-clock kill enforced by this orchestrator (not the program). The
 * container is force-removed after every run.
 */
const docker = new Docker(); // default unix socket

export interface SandboxSpec {
  image: string;
  /** filename -> contents, written into a fresh job dir mounted read-only at /job */
  files: Record<string, string>;
  timeoutMs: number;
  memoryBytes: number;
  nanoCpus: number;
  pidsLimit: number;
  /** hard cap on captured stdout/stderr each, to bound server memory (CWE-770) */
  maxOutputBytes: number;
}

export interface SandboxResult {
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export async function runInSandbox(spec: SandboxSpec): Promise<SandboxResult> {
  const jobDir = await mkdtemp(join(tmpdir(), "dsa-job-"));
  try {
    for (const [name, content] of Object.entries(spec.files)) {
      await writeFile(join(jobDir, name), content, { mode: 0o644 });
    }
    return await runContainer(jobDir, spec);
  } finally {
    await rm(jobDir, { recursive: true, force: true });
  }
}

/** A Writable that accumulates up to `cap` bytes and silently drops the rest. */
function capWritable(chunks: Buffer[], cap: number): Writable {
  let total = 0;
  return new Writable({
    write(chunk: Buffer, _enc, cb) {
      if (total < cap) {
        const room = cap - total;
        const slice = chunk.length <= room ? chunk : chunk.subarray(0, room);
        chunks.push(slice);
        total += slice.length;
      }
      cb();
    },
  });
}

async function runContainer(jobDir: string, spec: SandboxSpec): Promise<SandboxResult> {
  const startedAt = Date.now();

  const container = await docker.createContainer({
    Image: spec.image,
    Tty: false,
    OpenStdin: false,
    AttachStdout: true,
    AttachStderr: true,
    User: "10001:10001",
    HostConfig: {
      NetworkMode: "none",
      Memory: spec.memoryBytes,
      MemorySwap: spec.memoryBytes, // == Memory => no swap
      NanoCpus: spec.nanoCpus,
      PidsLimit: spec.pidsLimit,
      ReadonlyRootfs: true,
      Tmpfs: { "/tmp": "exec" },
      Binds: [`${jobDir}:/job:ro`],
      CapDrop: ["ALL"],
      SecurityOpt: ["no-new-privileges"],
      AutoRemove: false, // removed manually AFTER logs are read
    },
  });

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  const stream = await container.attach({ stream: true, stdout: true, stderr: true });
  const streamClosed = new Promise<void>((resolve) => {
    stream.on("end", resolve);
    stream.on("close", resolve);
  });
  container.modem.demuxStream(
    stream,
    capWritable(stdoutChunks, spec.maxOutputBytes),
    capWritable(stderrChunks, spec.maxOutputBytes),
  );

  await container.start();

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    container.kill().catch(() => {}); // best-effort; wait() then resolves
  }, spec.timeoutMs);

  let exitCode: number | null = null;
  try {
    const status = await container.wait();
    exitCode = typeof status.StatusCode === "number" ? status.StatusCode : null;
  } finally {
    clearTimeout(timer);
  }

  // Give the log stream a moment to flush, but don't hang forever on it.
  await Promise.race([streamClosed, new Promise((r) => setTimeout(r, 2000))]);
  await container.remove({ force: true }).catch(() => {});

  return {
    exitCode,
    timedOut,
    stdout: Buffer.concat(stdoutChunks).toString("utf8"),
    stderr: Buffer.concat(stderrChunks).toString("utf8"),
    durationMs: Date.now() - startedAt,
  };
}
