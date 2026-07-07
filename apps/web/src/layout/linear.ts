/**
 * Layout engine — separates layout math from rendering (ARCHITECTURE §4).
 *
 * Phase 2 ships the linear layout only (nodes in a row, in creation order); it's all a
 * linked list needs. Hierarchical (tree) and force-directed (graph) layouts slot in
 * behind the same `Point`/`Layout` shape in M7.
 */
export interface Point {
  x: number;
  y: number;
}

export type Layout = Record<string, Point>;

export const NODE_W = 56;
export const NODE_H = 40;
const GAP = 44;
const ROW_Y = 50;

/** Place node ids left-to-right in a single row. */
export function linearLayout(orderedIds: string[]): Layout {
  const layout: Layout = {};
  orderedIds.forEach((id, i) => {
    layout[id] = { x: i * (NODE_W + GAP), y: ROW_Y };
  });
  return layout;
}

/** Total drawing size for the given node count, for the SVG viewBox. */
export function linearBounds(count: number): { width: number; height: number } {
  return {
    width: Math.max(NODE_W, count * (NODE_W + GAP) - GAP),
    height: ROW_Y + NODE_H + 30, // room for back-edge arcs above
  };
}
