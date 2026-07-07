import type { TraceEvent } from "@dsa/trace-schema";

/**
 * Materialized state for the Table family (Phase 4: DP tables). A 2D grid of cells
 * plus the cell touched by the most recent event and, for writes, the cells it was
 * derived from (`deps`) — the renderer draws dependency arrows from those into the
 * written cell.
 */
export interface CellRef {
  row: number;
  col: number;
}

export interface TableState {
  rows: number;
  cols: number;
  values: unknown[][];
  read: CellRef | null;
  write: CellRef | null;
  deps: CellRef[];
}

export const TABLE_EMPTY: TableState = {
  rows: 0,
  cols: 0,
  values: [],
  read: null,
  write: null,
  deps: [],
};

/** Pure reducer: (state, event) => newState. Never mutates its input. */
export function tableReduce(state: TableState, event: TraceEvent): TableState {
  switch (event.type) {
    case "dp_init": {
      const { rows, cols } = event.payload;
      return {
        rows,
        cols,
        values: Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0)),
        read: null,
        write: null,
        deps: [],
      };
    }

    case "dp_cell_read":
      return {
        ...state,
        read: { row: event.payload.row, col: event.payload.col },
        write: null,
        deps: [],
      };

    case "dp_cell_write": {
      const { row, col, newValue, dependsOn } = event.payload;
      const values = state.values.map((r) => r.slice());
      if (values[row]) values[row][col] = newValue;
      return {
        ...state,
        values,
        read: null,
        write: { row, col },
        deps: (dependsOn ?? []).map((d) => ({ row: d.row, col: d.col })),
      };
    }

    default:
      return state;
  }
}
