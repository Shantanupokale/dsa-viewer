import type { EventType, TraceEvent } from "@dsa/trace-schema";

/**
 * Materialized state for the Sequence family (Phase 0: arrays). A pure reducer folds
 * TraceEvents into this shape; the renderer draws it. `read`/`write`/`swap` carry the
 * indices touched by the most recent event so the renderer can highlight/animate them.
 */
export interface SequenceState {
  values: unknown[];
  read: number[];
  write: number[];
  swap: readonly [number, number] | null;
  lastEventType: EventType | null;
}

export const SEQUENCE_EMPTY: SequenceState = {
  values: [],
  read: [],
  write: [],
  swap: null,
  lastEventType: null,
};

/** Pure reducer: (state, event) => newState. Never mutates its input. */
export function sequenceReduce(state: SequenceState, event: TraceEvent): SequenceState {
  switch (event.type) {
    case "array_init":
      return {
        values: [...event.payload.initialValues],
        read: [],
        write: [],
        swap: null,
        lastEventType: event.type,
      };

    case "array_read":
      return { ...state, read: [event.payload.index], write: [], swap: null, lastEventType: event.type };

    case "array_write": {
      const values = state.values.slice();
      values[event.payload.index] = event.payload.newValue;
      return { ...state, values, read: [], write: [event.payload.index], swap: null, lastEventType: event.type };
    }

    case "array_swap": {
      const { indexA, indexB } = event.payload;
      const values = state.values.slice();
      const tmp = values[indexA];
      values[indexA] = values[indexB];
      values[indexB] = tmp;
      return { ...state, values, read: [], write: [], swap: [indexA, indexB], lastEventType: event.type };
    }

    default:
      // Not a sequence event — leave state untouched (multiple structures can coexist).
      return state;
  }
}
