import type { TraceEvent } from "@dsa/trace-schema";
import { describe, expect, it } from "vitest";
import { sequencePlugin } from "../plugins/sequence";
import type { VisualizationPlugin } from "../plugins/types";
import { usePlayer } from "./playerStore";

/**
 * NFR1 benchmark (PRD §14): a 50,000-event trace must scrub to ANY point in <100ms,
 * via snapshots + incremental replay — never a full fold from event 0.
 *
 * This drives the real store (load -> snapshot build, seekTo + materialize) with a
 * synthetic-but-schema-valid 50k array trace. Runs in CI via `npm test -w @dsa/web`.
 */
const N_EVENTS = 50_000;
const ARRAY_LEN = 200;

function makeTrace(): TraceEvent[] {
  const events: TraceEvent[] = [
    {
      step: 0,
      type: "array_init",
      structureId: "nums",
      payload: { length: ARRAY_LEN, initialValues: Array.from({ length: ARRAY_LEN }, (_, i) => i) },
    },
  ];
  // Deterministic LCG so the benchmark is reproducible.
  let seed = 42;
  const rnd = (mod: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % mod;
  };
  for (let step = 1; step < N_EVENTS; step++) {
    const kind = step % 3;
    const i = rnd(ARRAY_LEN);
    if (kind === 0) {
      events.push({ step, type: "array_read", structureId: "nums", payload: { index: i, value: i } });
    } else if (kind === 1) {
      events.push({
        step,
        type: "array_write",
        structureId: "nums",
        payload: { index: i, oldValue: i, newValue: rnd(1000) },
      });
    } else {
      events.push({
        step,
        type: "array_swap",
        structureId: "nums",
        payload: { indexA: i, indexB: rnd(ARRAY_LEN) },
      });
    }
  }
  return events;
}

describe("NFR1: 50k-event scrubbing", () => {
  it("seeks to any of 200 random points with p95 < 100ms", () => {
    const events = makeTrace();
    const store = usePlayer.getState();

    const tLoad = performance.now();
    store.load(events, sequencePlugin as unknown as VisualizationPlugin);
    const loadMs = performance.now() - tLoad;

    let seed = 7;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % N_EVENTS;
    };

    const timings: number[] = [];
    for (let k = 0; k < 200; k++) {
      const target = rnd();
      const t0 = performance.now();
      usePlayer.getState().seekTo(target);
      const state = usePlayer.getState().materialize(target);
      timings.push(performance.now() - t0);
      expect(state).toBeTruthy();
    }

    timings.sort((a, b) => a - b);
    const p50 = timings[Math.floor(timings.length * 0.5)]!;
    const p95 = timings[Math.floor(timings.length * 0.95)]!;
    const max = timings[timings.length - 1]!;

    // process.stdout.write bypasses vitest's console interception so the numbers
    // always appear in test output — they're what the commit message quotes.
    process.stdout.write(
      `\nNFR1 bench: load(50k)=${loadMs.toFixed(1)}ms  seek p50=${p50.toFixed(2)}ms  p95=${p95.toFixed(2)}ms  max=${max.toFixed(2)}ms\n`,
    );

    expect(p95).toBeLessThan(100);
  });

  it("materialize at a step is correct after seeking (not just fast)", () => {
    // Small deterministic check: fold-from-snapshot must equal fold-from-zero.
    const events = makeTrace().slice(0, 12_345);
    const plugin = sequencePlugin as unknown as VisualizationPlugin;
    usePlayer.getState().load(events, plugin);

    let full: unknown = plugin.emptyState;
    for (const e of events) full = plugin.reduce(full, e);

    const viaSnapshots = usePlayer.getState().materialize(events.length - 1);
    expect(viaSnapshots).toEqual(full);
  });
});
