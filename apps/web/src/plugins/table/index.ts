import type { VisualizationPlugin } from "../types";
import { TableScene } from "./TableScene";
import { TABLE_EMPTY, tableReduce, type TableState } from "./state";

/**
 * The Table plugin (Phase 4: DP tables). Segment tree / Fenwick / sparse-table events
 * are listed as supported so M9+ extends the reducer + renderer, not the registry.
 */
export const tablePlugin: VisualizationPlugin<TableState> = {
  name: "table",
  supportedEvents: [
    "dp_init",
    "dp_cell_read",
    "dp_cell_write",
    // M9+ targets:
    "segtree_build",
    "segtree_query",
    "segtree_update",
  ],
  emptyState: TABLE_EMPTY,
  reduce: tableReduce,
  renderer: TableScene,
  animationPresets: {
    dp_cell_read: { durationMs: 250, easing: "easeInOut", transitionType: "glow" },
    dp_cell_write: { durationMs: 450, easing: "easeInOut", transitionType: "scale" },
  },
};
