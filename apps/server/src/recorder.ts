import { isTraceLine, parseTraceLine, type TraceEvent } from "@dsa/trace-schema";

/**
 * Timeline Recorder (PRD §9.1). Turns the raw stdout of untrusted user code into a
 * validated TraceEvent stream plus the pass-through (non-trace) stdout.
 *
 * Every trace line is validated via @dsa/trace-schema; anything that fails is
 * counted and DROPPED — one malformed line never crashes the run, and no unvalidated
 * data reaches the replay pipeline.
 *
 * Note: periodic materialized snapshots (PRD §9.3) are computed on the FRONTEND,
 * where the per-renderer reducers live, so this recorder stays renderer-agnostic.
 */
export interface RecorderResult {
  events: TraceEvent[];
  stdout: string; // non-trace lines, in order
  dropped: number; // trace lines that failed validation or exceeded the event cap
}

export function record(rawStdout: string, maxEvents = 200_000): RecorderResult {
  const events: TraceEvent[] = [];
  const plain: string[] = [];
  let dropped = 0;

  for (const line of rawStdout.split("\n")) {
    if (!isTraceLine(line)) {
      // Preserve blank lines within user output but skip a single trailing newline artifact.
      plain.push(line);
      continue;
    }
    if (events.length >= maxEvents) {
      dropped++;
      continue;
    }
    const result = parseTraceLine(line);
    if (result.ok) events.push(result.event);
    else dropped++;
  }

  // Drop one trailing empty element produced by a final newline.
  if (plain.length > 0 && plain[plain.length - 1] === "") plain.pop();

  return { events, stdout: plain.join("\n"), dropped };
}
