import type { TraceEvent } from "@dsa/trace-schema";

/**
 * Materialized state for the heap. The heap is array-backed (parent i → children
 * 2i+1 / 2i+2); the renderer derives the binary-tree picture from the array, so this
 * state is just the values plus the cells touched by the most recent event.
 */
export interface HeapState {
  values: unknown[];
  lastSwap: readonly [number, number] | null;
  lastPushed: number | null; // index of the just-pushed value
  lastExtracted: unknown; // value just popped off the top
}

export const HEAP_EMPTY: HeapState = {
  values: [],
  lastSwap: null,
  lastPushed: null,
  lastExtracted: null,
};

/** Pure reducer mirroring the tracer's heap operations. Never mutates its input. */
export function heapReduce(state: HeapState, event: TraceEvent): HeapState {
  switch (event.type) {
    case "heap_init":
      return { ...HEAP_EMPTY, values: [...event.payload.initialValues] };

    case "heap_push":
      return {
        ...state,
        values: [...state.values, event.payload.value],
        lastSwap: null,
        lastPushed: state.values.length,
        lastExtracted: null,
      };

    case "heap_swap": {
      const { indexA, indexB } = event.payload;
      const values = state.values.slice();
      const t = values[indexA];
      values[indexA] = values[indexB];
      values[indexB] = t;
      return { ...state, values, lastSwap: [indexA, indexB], lastPushed: null, lastExtracted: null };
    }

    case "heap_extract": {
      // Mirrors the tracer: last element moves to the root, length shrinks by one.
      const values = state.values.slice();
      const last = values.pop();
      if (values.length > 0) values[0] = last;
      return { ...state, values, lastSwap: null, lastPushed: null, lastExtracted: event.payload.value };
    }

    default:
      return state;
  }
}
