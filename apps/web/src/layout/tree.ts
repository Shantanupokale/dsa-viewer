import { hierarchy, tree } from "d3-hierarchy";
import { NODE_H, NODE_W, type Layout } from "./linear";

/**
 * Hierarchical (tidy-tree) layout via d3-hierarchy. Robust to partial trees during
 * incremental build: nodes with children act as subtree roots; still-unparented,
 * childless nodes drop into an "orphan" row below (so a tree animates into shape as
 * edges arrive rather than throwing).
 */
interface TN {
  id: string;
  children: TN[];
}

const H_STEP = NODE_W + 28;
const V_STEP = NODE_H + 44;

export function treeLayout(
  nodeIds: string[],
  edges: Array<{ from: string; to: string }>,
): { layout: Layout; width: number; height: number } {
  const layout: Layout = {};
  if (nodeIds.length === 0) return { layout, width: 0, height: 0 };

  const present = new Set(nodeIds);
  const childrenMap: Record<string, string[]> = {};
  const hasParent: Record<string, boolean> = {};
  for (const e of edges) {
    if (!present.has(e.from) || !present.has(e.to)) continue;
    (childrenMap[e.from] ??= []).push(e.to);
    hasParent[e.to] = true;
  }

  const roots = nodeIds.filter((id) => !hasParent[id] && (childrenMap[id]?.length ?? 0) > 0);
  const placed = new Set<string>();
  let maxX = 0;
  let maxY = 0;
  let yOffset = 0;

  const build = (id: string): TN => ({ id, children: (childrenMap[id] ?? []).map(build) });

  for (const rootId of roots) {
    const root = hierarchy<TN>(build(rootId), (d) => d.children);
    const positioned = tree<TN>().nodeSize([H_STEP, V_STEP])(root);

    let minX = Infinity;
    let maxDepth = 0;
    positioned.each((n) => {
      minX = Math.min(minX, n.x);
      maxDepth = Math.max(maxDepth, n.depth);
    });
    positioned.each((n) => {
      const x = n.x - minX;
      const y = yOffset + n.depth * V_STEP;
      layout[n.data.id] = { x, y };
      placed.add(n.data.id);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
    yOffset += (maxDepth + 1) * V_STEP + 24;
  }

  // Orphans (no edges yet) — a row beneath the placed subtrees.
  let col = 0;
  for (const id of nodeIds) {
    if (placed.has(id)) continue;
    const x = col * H_STEP;
    layout[id] = { x, y: yOffset };
    col++;
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, yOffset);
  }

  return { layout, width: maxX + NODE_W, height: maxY + NODE_H };
}
