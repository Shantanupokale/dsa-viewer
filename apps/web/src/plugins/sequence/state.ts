import type { EventType, TraceEvent } from "@dsa/trace-schema";

/**
 * Materialized state for the Sequence family. A single trace can contain several
 * structures (e.g. sliding-window-max uses a deque + an array), so state is keyed by
 * `structureId`. Each sub-state is a row of cells plus the indices touched by the most
 * recent event, which the renderer highlights/animates.
 */
export type SequenceKind = "array" | "string" | "stack" | "queue" | "deque";

export interface SequenceSubState {
  kind: SequenceKind;
  values: unknown[];
  read: number[];
  write: number[];
  swap: readonly [number, number] | null;
  active: number[]; // last pushed/popped/enqueued/dequeued cell(s)
  lastEventType: EventType | null;
}

export interface SequenceState {
  order: string[]; // structureId order of first appearance
  byId: Record<string, SequenceSubState>;
}

export const SEQUENCE_EMPTY: SequenceState = { order: [], byId: {} };

const KIND_BY_PREFIX: Array<[string, SequenceKind]> = [
  ["array_", "array"],
  ["string_", "string"],
  ["stack_", "stack"],
  ["queue_", "queue"],
  ["deque_", "deque"],
];

function kindFor(type: string): SequenceKind | null {
  for (const [prefix, kind] of KIND_BY_PREFIX) if (type.startsWith(prefix)) return kind;
  return null;
}

const emptySub = (kind: SequenceKind): SequenceSubState => ({
  kind,
  values: [],
  read: [],
  write: [],
  swap: null,
  active: [],
  lastEventType: null,
});

/** Pure reducer: routes each event to its structure's sub-state. Never mutates input. */
export function sequenceReduce(state: SequenceState, event: TraceEvent): SequenceState {
  const kind = kindFor(event.type);
  if (!kind) return state; // not a sequence event

  const id = event.structureId;
  const prev = state.byId[id] ?? emptySub(kind);
  const next = applyToSub(prev, event);

  return {
    order: state.order.includes(id) ? state.order : [...state.order, id],
    byId: { ...state.byId, [id]: next },
  };
}

function applyToSub(s: SequenceSubState, event: TraceEvent): SequenceSubState {
  const base = { ...s, read: [], write: [], swap: null, active: [], lastEventType: event.type };

  switch (event.type) {
    // ---- array ----
    case "array_init":
      return { ...base, kind: "array", values: [...event.payload.initialValues] };
    case "array_read":
      return { ...base, read: [event.payload.index] };
    case "array_write": {
      const values = s.values.slice();
      values[event.payload.index] = event.payload.newValue;
      return { ...base, values, write: [event.payload.index] };
    }
    case "array_swap": {
      const { indexA, indexB } = event.payload;
      const values = s.values.slice();
      const t = values[indexA];
      values[indexA] = values[indexB];
      values[indexB] = t;
      return { ...base, values, swap: [indexA, indexB] };
    }

    // ---- string ----
    case "string_init":
      return { ...base, kind: "string", values: event.payload.value.split("") };
    case "string_compare":
      return { ...base, read: [event.payload.indexA, event.payload.indexB] };

    // ---- stack (top = end) ----
    case "stack_push": {
      const values = [...s.values, event.payload.value];
      return { ...base, values, active: [values.length - 1] };
    }
    case "stack_pop": {
      const values = s.values.slice(0, -1);
      return { ...base, values };
    }
    case "stack_peek":
      return { ...base, active: s.values.length > 0 ? [s.values.length - 1] : [] };

    // ---- queue (rear in, front out) ----
    case "queue_enqueue": {
      const values = [...s.values, event.payload.value];
      return { ...base, values, active: [values.length - 1] };
    }
    case "queue_dequeue":
      return { ...base, values: s.values.slice(1) };
    case "queue_peek":
      return { ...base, active: s.values.length > 0 ? [0] : [] };

    // ---- deque (both ends) ----
    case "deque_push_front":
      return { ...base, values: [event.payload.value, ...s.values], active: [0] };
    case "deque_push_back": {
      const values = [...s.values, event.payload.value];
      return { ...base, values, active: [values.length - 1] };
    }
    case "deque_pop_front":
      return { ...base, values: s.values.slice(1) };
    case "deque_pop_back":
      return { ...base, values: s.values.slice(0, -1) };

    default:
      return s; // unrelated event type for this family
  }
}
