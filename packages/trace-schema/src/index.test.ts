import { describe, expect, it } from "vitest";
import {
  EVENT_TYPES,
  MAX_TRACE_LINE_LENGTH,
  TRACE_PREFIX,
  TraceEventSchema,
  isTraceLine,
  parseTraceLine,
  type EventType,
} from "./index.js";

/** Build a full event envelope for a given type + payload. */
function mk(type: EventType, payload: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { step: 0, structureId: "s1", type, payload, ...extra };
}

/**
 * One VALID payload per event type. Every EventType must appear here — the
 * coverage test below fails if a new type is added without a fixture.
 */
const VALID: Record<EventType, Record<string, unknown>> = {
  array_init: { length: 3, initialValues: [1, 2, 3] },
  array_read: { index: 0, value: 5 },
  array_write: { index: 1, oldValue: 2, newValue: 9 },
  array_swap: { indexA: 0, indexB: 1 },
  string_init: { length: 3, value: "abc" },
  string_compare: { indexA: 0, indexB: 1, charA: "a", charB: "b", isMatch: false },
  string_match: { startIndex: 2, length: 3 },
  pointer_move: { pointerName: "left", index: 0 },
  stack_push: { value: 5 },
  stack_pop: { value: 5 },
  stack_peek: { value: 5 },
  queue_enqueue: { value: 1 },
  queue_dequeue: { value: 1 },
  queue_peek: { value: 1 },
  deque_push_front: { value: 1 },
  deque_push_back: { value: 1 },
  deque_pop_front: { value: 1 },
  deque_pop_back: { value: 1 },
  window_update: { left: 0, right: 2, currentAggregate: 7 },
  linkedlist_init: { doubly: true },
  linkedlist_node_create: { nodeId: "n1", value: 5 },
  linkedlist_pointer_update: { nodeId: "n1", pointerName: "next", targetNodeId: "n2" },
  linkedlist_insert: { nodeId: "n1", afterNodeId: null },
  linkedlist_delete: { nodeId: "n1" },
  linkedlist_traverse: { nodeId: "n1" },
  graph_init: { directed: false, layout: "tree" },
  graph_add_node: { nodeId: "a", value: 5 },
  graph_add_edge: { fromNodeId: "a", toNodeId: "b" },
  node_visit: { nodeId: "a", state: "visiting" },
  edge_traverse: { fromNodeId: "a", toNodeId: "b", weight: 3 },
  backtrack: { fromNodeId: "b", toNodeId: "a" },
  tree_init: { rootNodeId: "r" },
  tree_node_visit: { nodeId: "r", order: "in" },
  tree_rotate: { pivotNodeId: "r", direction: "left" },
  trie_insert: { nodeId: "t1", char: "a", parentNodeId: null },
  trie_visit: { nodeId: "t1" },
  dp_init: { rows: 3, cols: 4 },
  dp_cell_read: { row: 0, col: 0, value: 0 },
  dp_cell_write: { row: 1, col: 1, oldValue: 0, newValue: 5, dependsOn: [{ row: 0, col: 1 }] },
  segtree_build: { size: 8 },
  segtree_query: { left: 0, right: 3, result: 10 },
  segtree_update: { index: 2, value: 5 },
  heap_swap: { indexA: 0, indexB: 2 },
  heap_extract: { value: 9 },
  call_push: { functionName: "solve", args: { i: 0 } },
  call_return: { functionName: "solve", returnValue: 1 },
  console_log: { message: "hi" },
};

/**
 * One INVALID example per event type. Types with a constrained payload field break
 * that field; value-only types (payload is just `{ value: unknown }`) break the
 * envelope instead (a negative `step`), which is still an invalid event of that type.
 */
const INVALID: Record<EventType, Record<string, unknown>> = {
  array_init: { length: "3", initialValues: [] },
  array_read: { index: "x", value: 1 },
  array_write: { index: -1, oldValue: 1, newValue: 2 },
  array_swap: { indexA: "0", indexB: 1 },
  string_init: { length: 3, value: 42 },
  string_compare: { indexA: 0, indexB: 1, charA: "a", charB: "b", isMatch: "no" },
  string_match: { startIndex: -1, length: 3 },
  pointer_move: { pointerName: "", index: 0 },
  stack_push: { value: 5, __brokenStep: true },
  stack_pop: { value: 5, __brokenStep: true },
  stack_peek: { value: 5, __brokenStep: true },
  queue_enqueue: { value: 1, __brokenStep: true },
  queue_dequeue: { value: 1, __brokenStep: true },
  queue_peek: { value: 1, __brokenStep: true },
  deque_push_front: { value: 1, __brokenStep: true },
  deque_push_back: { value: 1, __brokenStep: true },
  deque_pop_front: { value: 1, __brokenStep: true },
  deque_pop_back: { value: 1, __brokenStep: true },
  window_update: { left: "0", right: 2 },
  linkedlist_init: { doubly: "yes" },
  linkedlist_node_create: { nodeId: "", value: 5 },
  linkedlist_pointer_update: { nodeId: "n1", pointerName: "sideways", targetNodeId: "n2" },
  linkedlist_insert: { nodeId: 1, afterNodeId: null },
  linkedlist_delete: { nodeId: "" },
  linkedlist_traverse: { nodeId: 5 },
  graph_init: { directed: 1 },
  graph_add_node: { nodeId: "" },
  graph_add_edge: { fromNodeId: "a" },
  node_visit: { nodeId: "a", state: "exploring" },
  edge_traverse: { fromNodeId: "a", toNodeId: "b", weight: "heavy" },
  backtrack: { fromNodeId: "b" },
  tree_init: { rootNodeId: 7 },
  tree_node_visit: { nodeId: "r", order: "sideways" },
  tree_rotate: { pivotNodeId: "r", direction: "up" },
  trie_insert: { nodeId: "t1", char: 5, parentNodeId: null },
  trie_visit: { nodeId: 0 },
  dp_init: { rows: -3, cols: 4 },
  dp_cell_read: { row: 0, col: "x", value: 0 },
  dp_cell_write: { row: 1, col: 1, oldValue: 0, newValue: 5, dependsOn: [{ row: -1, col: 1 }] },
  segtree_build: { size: "8" },
  segtree_query: { left: 0, right: -3 },
  segtree_update: { index: -2, value: 5 },
  heap_swap: { indexA: 0.5, indexB: 2 },
  heap_extract: { value: 9, __brokenStep: true },
  call_push: { functionName: "", args: {} },
  call_return: { functionName: 5, returnValue: 1 },
  console_log: { message: 42 },
};

/** Types whose INVALID fixture relies on breaking the envelope, not the payload. */
const ENVELOPE_BROKEN = new Set<EventType>([
  "stack_push", "stack_pop", "stack_peek",
  "queue_enqueue", "queue_dequeue", "queue_peek",
  "deque_push_front", "deque_push_back", "deque_pop_front", "deque_pop_back",
  "heap_extract",
]);

describe("event type coverage", () => {
  it("has a valid + invalid fixture for every EventType", () => {
    for (const t of EVENT_TYPES) {
      expect(VALID, `missing VALID fixture for ${t}`).toHaveProperty(t);
      expect(INVALID, `missing INVALID fixture for ${t}`).toHaveProperty(t);
    }
    expect(Object.keys(VALID).sort()).toEqual([...EVENT_TYPES].sort());
  });
});

describe("TraceEventSchema", () => {
  for (const type of EVENT_TYPES) {
    it(`accepts a valid ${type} event`, () => {
      const result = TraceEventSchema.safeParse(mk(type, VALID[type]));
      expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(true);
      if (result.success) expect(result.data.type).toBe(type);
    });

    it(`rejects an invalid ${type} event`, () => {
      const event = ENVELOPE_BROKEN.has(type)
        ? mk(type, VALID[type], { step: -1 }) // negative step fails the envelope
        : mk(type, INVALID[type]);
      expect(TraceEventSchema.safeParse(event).success).toBe(false);
    });
  }

  it("rejects an unknown event type", () => {
    expect(TraceEventSchema.safeParse(mk("not_a_real_type" as EventType, {})).success).toBe(false);
  });

  it("accepts optional envelope fields", () => {
    const result = TraceEventSchema.safeParse(
      mk("array_read", VALID.array_read, { codeLine: 12, callDepth: 2, timestampMs: 5 }),
    );
    expect(result.success).toBe(true);
  });

  it("strips unknown payload keys (forward compatibility)", () => {
    const result = TraceEventSchema.safeParse(
      mk("array_read", { index: 0, value: 5, futureField: "ignored" }),
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.payload).not.toHaveProperty("futureField");
  });
});

describe("parseTraceLine", () => {
  it("parses a well-formed trace line", () => {
    const line = TRACE_PREFIX + JSON.stringify(mk("stack_push", { value: 7 }));
    const result = parseTraceLine(line);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.event.type).toBe("stack_push");
  });

  it("flags a non-trace line", () => {
    const result = parseTraceLine("regular user debug output");
    expect(result).toMatchObject({ ok: false, reason: "not_trace_line" });
  });

  it("flags invalid JSON", () => {
    const result = parseTraceLine(TRACE_PREFIX + "{not json");
    expect(result).toMatchObject({ ok: false, reason: "invalid_json" });
  });

  it("flags a schema-invalid event", () => {
    const line = TRACE_PREFIX + JSON.stringify(mk("array_read", { index: "x", value: 1 }));
    const result = parseTraceLine(line);
    expect(result).toMatchObject({ ok: false, reason: "schema" });
  });

  it("rejects an over-long line without parsing", () => {
    const huge = TRACE_PREFIX + "\"" + "a".repeat(MAX_TRACE_LINE_LENGTH + 1) + "\"";
    const result = parseTraceLine(huge);
    expect(result).toMatchObject({ ok: false, reason: "too_long" });
  });

  it("isTraceLine matches only the sentinel prefix", () => {
    expect(isTraceLine(TRACE_PREFIX + "{}")).toBe(true);
    expect(isTraceLine(" leading space" + TRACE_PREFIX)).toBe(false);
  });
});
