/**
 * @dsa/trace-schema — the single source of truth for the execution-trace contract.
 *
 * Everything downstream (tracer SDKs, Timeline Recorder, Replay Engine, renderers)
 * depends on the shapes defined here. Change this package deliberately.
 *
 * Trust boundary: trace lines arrive on the *stdout of untrusted user code* running
 * in a sandbox. The Timeline Recorder MUST validate every line through
 * {@link parseTraceLine} and drop anything that fails — never trust the raw string.
 * Unknown payload keys are stripped (zod default), so a newer tracer emitting extra
 * fields degrades gracefully instead of being rejected, and no unexpected field can
 * leak into consumers.
 */

import { z } from "zod";

/** Bumped when the wire contract changes in a backwards-incompatible way. */
export const SCHEMA_VERSION = 1 as const;

/** Every trace line on stdout starts with this sentinel; user debug output does not. */
export const TRACE_PREFIX = "@TRACE@";

/**
 * Hard cap on a single trace line (post-prefix), in UTF-16 code units. Guards the
 * recorder against a pathologically large single line exhausting memory. The server
 * separately caps total events / total stdout.
 */
export const MAX_TRACE_LINE_LENGTH = 1_000_000;

// ---------------------------------------------------------------------------
// Envelope: fields common to every event, independent of `type`.
// ---------------------------------------------------------------------------

const baseFields = {
  step: z.number().int().nonnegative(),
  structureId: z.string().min(1),
  codeLine: z.number().int().positive().optional(),
  callDepth: z.number().int().nonnegative().optional(),
  timestampMs: z.number().nonnegative().optional(),
};

/**
 * Build one member of the discriminated union: base envelope + a `type` literal +
 * a typed `payload`. Payload objects strip unknown keys (forward-compatible).
 */
function event<T extends string, P extends z.ZodRawShape>(
  type: T,
  payload: z.ZodObject<P>,
) {
  return z.object({
    ...baseFields,
    type: z.literal(type),
    payload,
  });
}

/** A value the user's structure holds — any JSON-serialisable thing, or absent. */
const anyValue = z.unknown();

// ---------------------------------------------------------------------------
// Payload schemas, grouped by structure family (mirrors ARCHITECTURE.md §5).
// Shapes marked "provisional" are not pinned by PRD §6.1 and may tighten later.
// ---------------------------------------------------------------------------

const EVENTS = [
  // ---- Sequence family ---------------------------------------------------
  event("array_init", z.object({ length: z.number().int().nonnegative(), initialValues: z.array(anyValue) })),
  event("array_read", z.object({ index: z.number().int().nonnegative(), value: anyValue })),
  event("array_write", z.object({ index: z.number().int().nonnegative(), oldValue: anyValue, newValue: anyValue })),
  event("array_swap", z.object({ indexA: z.number().int().nonnegative(), indexB: z.number().int().nonnegative() })),

  event("string_init", z.object({ length: z.number().int().nonnegative(), value: z.string() })),
  event("string_compare", z.object({
    indexA: z.number().int().nonnegative(),
    indexB: z.number().int().nonnegative(),
    charA: z.string(),
    charB: z.string(),
    isMatch: z.boolean(),
  })),
  // provisional: pattern-match highlight for KMP / Z-algorithm
  event("string_match", z.object({ startIndex: z.number().int().nonnegative(), length: z.number().int().nonnegative() })),
  // provisional: two-pointer movement
  event("pointer_move", z.object({ pointerName: z.string().min(1), index: z.number().int() })),

  event("stack_push", z.object({ value: anyValue })),
  event("stack_pop", z.object({ value: anyValue })),
  event("stack_peek", z.object({ value: anyValue })),

  event("queue_enqueue", z.object({ value: anyValue })),
  event("queue_dequeue", z.object({ value: anyValue })),
  event("queue_peek", z.object({ value: anyValue })),

  event("deque_push_front", z.object({ value: anyValue })),
  event("deque_push_back", z.object({ value: anyValue })),
  event("deque_pop_front", z.object({ value: anyValue })),
  event("deque_pop_back", z.object({ value: anyValue })),

  event("window_update", z.object({
    left: z.number().int(),
    right: z.number().int(),
    currentAggregate: anyValue.optional(),
  })),

  // ---- Node-link family --------------------------------------------------
  // provisional: init carries no payload beyond the envelope's structureId
  event("linkedlist_init", z.object({ doubly: z.boolean().optional() })),
  event("linkedlist_node_create", z.object({ nodeId: z.string().min(1), value: anyValue })),
  event("linkedlist_pointer_update", z.object({
    nodeId: z.string().min(1),
    pointerName: z.enum(["next", "prev"]),
    targetNodeId: z.string().min(1).nullable(),
  })),
  // provisional
  event("linkedlist_insert", z.object({ nodeId: z.string().min(1), afterNodeId: z.string().min(1).nullable() })),
  event("linkedlist_delete", z.object({ nodeId: z.string().min(1) })),
  event("linkedlist_traverse", z.object({ nodeId: z.string().min(1) })),

  event("graph_init", z.object({ directed: z.boolean().optional() })),
  event("node_visit", z.object({ nodeId: z.string().min(1), state: z.enum(["visiting", "visited"]) })),
  event("edge_traverse", z.object({
    fromNodeId: z.string().min(1),
    toNodeId: z.string().min(1),
    weight: z.number().optional(),
  })),
  event("backtrack", z.object({ fromNodeId: z.string().min(1), toNodeId: z.string().min(1) })),

  event("tree_init", z.object({ rootNodeId: z.string().min(1).nullable().optional() })),
  event("tree_node_visit", z.object({
    nodeId: z.string().min(1),
    order: z.enum(["pre", "in", "post", "level"]),
  })),
  // provisional
  event("tree_rotate", z.object({ pivotNodeId: z.string().min(1), direction: z.enum(["left", "right"]) })),

  // provisional
  event("trie_insert", z.object({
    nodeId: z.string().min(1),
    char: z.string(),
    parentNodeId: z.string().min(1).nullable(),
    isWordEnd: z.boolean().optional(),
  })),
  event("trie_visit", z.object({ nodeId: z.string().min(1) })),

  // ---- Table family ------------------------------------------------------
  event("dp_init", z.object({ rows: z.number().int().nonnegative(), cols: z.number().int().nonnegative() })),
  event("dp_cell_read", z.object({ row: z.number().int().nonnegative(), col: z.number().int().nonnegative(), value: anyValue })),
  event("dp_cell_write", z.object({
    row: z.number().int().nonnegative(),
    col: z.number().int().nonnegative(),
    oldValue: anyValue,
    newValue: anyValue,
    dependsOn: z.array(z.object({ row: z.number().int().nonnegative(), col: z.number().int().nonnegative() })).optional(),
  })),

  // provisional
  event("segtree_build", z.object({ size: z.number().int().nonnegative() })),
  event("segtree_query", z.object({ left: z.number().int().nonnegative(), right: z.number().int().nonnegative(), result: anyValue.optional() })),
  event("segtree_update", z.object({ index: z.number().int().nonnegative(), value: anyValue })),

  event("heap_swap", z.object({ indexA: z.number().int().nonnegative(), indexB: z.number().int().nonnegative() })),
  // provisional
  event("heap_extract", z.object({ value: anyValue })),

  // ---- Control flow ------------------------------------------------------
  event("call_push", z.object({ functionName: z.string().min(1), args: z.record(z.string(), anyValue) })),
  event("call_return", z.object({ functionName: z.string().min(1), returnValue: anyValue })),
  event("console_log", z.object({ message: z.string() })),
] as const;

/**
 * The full trace-event envelope, discriminated on `type`. Validating with this
 * both narrows the payload type and strips unknown keys.
 */
export const TraceEventSchema = z.discriminatedUnion("type", EVENTS);

/** A single validated trace event. */
export type TraceEvent = z.infer<typeof TraceEventSchema>;

/** Every legal `type` string. */
export type EventType = TraceEvent["type"];

/** Runtime list of every event type — handy for registries, tests, plugin `supportedEvents`. */
export const EVENT_TYPES: readonly EventType[] = EVENTS.map((e) => e.shape.type.value);

/** Narrow a TraceEvent to a specific `type`. */
export type EventOfType<T extends EventType> = Extract<TraceEvent, { type: T }>;

// ---------------------------------------------------------------------------
// Line parsing — the recorder's entry point for untrusted stdout.
// ---------------------------------------------------------------------------

export type ParseResult =
  | { ok: true; event: TraceEvent }
  | { ok: false; reason: "not_trace_line" | "too_long" | "invalid_json" | "schema"; error: string };

/** True if a raw stdout line is a trace line (vs. the user's own debug output). */
export function isTraceLine(line: string): boolean {
  return line.startsWith(TRACE_PREFIX);
}

/**
 * Parse one raw stdout line into a validated {@link TraceEvent}.
 *
 * Never throws — returns a discriminated result so the recorder can log-and-drop.
 * Only `{ ok: true }` results should ever reach the replay pipeline.
 */
export function parseTraceLine(rawLine: string): ParseResult {
  if (!isTraceLine(rawLine)) {
    return { ok: false, reason: "not_trace_line", error: "line does not start with @TRACE@" };
  }

  const json = rawLine.slice(TRACE_PREFIX.length);
  if (json.length > MAX_TRACE_LINE_LENGTH) {
    return { ok: false, reason: "too_long", error: `trace line exceeds ${MAX_TRACE_LINE_LENGTH} chars` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { ok: false, reason: "invalid_json", error: e instanceof Error ? e.message : "invalid JSON" };
  }

  const result = TraceEventSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, reason: "schema", error: result.error.message };
  }
  return { ok: true, event: result.data };
}
