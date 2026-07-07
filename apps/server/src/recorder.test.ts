import { TRACE_PREFIX } from "@dsa/trace-schema";
import { describe, expect, it } from "vitest";
import { record } from "./recorder.js";

const trace = (obj: unknown) => TRACE_PREFIX + JSON.stringify(obj);

describe("record", () => {
  it("separates trace events from plain stdout, in order", () => {
    const raw = [
      "starting",
      trace({ step: 0, type: "array_init", structureId: "a", payload: { length: 1, initialValues: [1] } }),
      trace({ step: 1, type: "array_swap", structureId: "a", payload: { indexA: 0, indexB: 0 } }),
      "done",
      "",
    ].join("\n");

    const result = record(raw);
    expect(result.events).toHaveLength(2);
    expect(result.events.map((e) => e.type)).toEqual(["array_init", "array_swap"]);
    expect(result.stdout).toBe("starting\ndone");
    expect(result.dropped).toBe(0);
  });

  it("drops malformed trace lines but keeps valid ones and never throws", () => {
    const raw = [
      trace({ step: 0, type: "array_init", structureId: "a", payload: { length: 1, initialValues: [1] } }),
      TRACE_PREFIX + "{not json",
      trace({ step: 1, type: "array_read", structureId: "a", payload: { index: "bad", value: 1 } }), // schema-invalid
      trace({ step: 2, type: "array_read", structureId: "a", payload: { index: 0, value: 1 } }),
    ].join("\n");

    const result = record(raw);
    expect(result.events.map((e) => e.type)).toEqual(["array_init", "array_read"]);
    expect(result.dropped).toBe(2);
  });

  it("caps the event count", () => {
    const raw = Array.from({ length: 5 }, (_, i) =>
      trace({ step: i, type: "stack_push", structureId: "s", payload: { value: i } }),
    ).join("\n");

    const result = record(raw, 3);
    expect(result.events).toHaveLength(3);
    expect(result.dropped).toBe(2);
  });
});
