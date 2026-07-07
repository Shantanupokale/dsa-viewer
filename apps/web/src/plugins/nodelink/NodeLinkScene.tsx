import { motion } from "framer-motion";
import { useMemo } from "react";
import { forceLayout } from "../../layout/force";
import { linearBounds, linearLayout, NODE_H, NODE_W, type Layout, type Point } from "../../layout/linear";
import { treeLayout } from "../../layout/tree";
import { tokens } from "../../theme/tokens";
import type { SceneProps } from "../types";
import type { NodeLinkEdge, NodeLinkState } from "./state";

/**
 * Node-link renderer. Linked lists use the linear layout (`next` arrows); trees/graphs
 * use their structural `edges` with a hierarchical layout (force layout lands in M7b).
 * Nodes animate to their positions; the visited path dims teal, the current node glows
 * emerald, and the most-recently-changed pointer/edge is amber.
 */
export function NodeLinkScene({ state, speed }: SceneProps<NodeLinkState>) {
  const duration = Math.max(0.1, 0.4 / Math.max(0.25, speed));

  // Recompute layout only when the structure (layout mode + nodes + edges) changes —
  // not on every playback step. Keeps force simulation off the hot path during traversal.
  const structureKey = `${state.layout}|${state.order.join(",")}|${state.edges.map((e) => `${e.from}>${e.to}`).join(",")}`;
  const { layout, width, height } = useMemo<{ layout: Layout; width: number; height: number }>(() => {
    if (state.order.length === 0) return { layout: {}, width: 0, height: 0 };
    if (state.layout === "tree") return treeLayout(state.order, state.edges);
    if (state.layout === "force") return forceLayout(state.order, state.edges);
    const b = linearBounds(state.order.length);
    return { layout: linearLayout(state.order), width: b.width, height: b.height };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structureKey]);

  if (state.order.length === 0) {
    return <div className="text-sm text-slate-500">No structure yet — run a solution to begin.</div>;
  }

  // Edges to draw: linked-list pointers (linear) or structural edges (tree/graph).
  const edges: Array<NodeLinkEdge & { active: boolean }> =
    state.layout === "linear"
      ? state.order
          .filter((id) => state.next[id])
          .map((id) => ({ from: id, to: state.next[id]!, active: state.lastPointerFrom === id }))
      : state.edges.map((e) => ({
          ...e,
          active: state.lastEdge?.from === e.from && state.lastEdge?.to === e.to,
        }));

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width + 16} height={height + 8} viewBox={`-8 -4 ${width + 16} ${height + 8}`} className="max-w-none">
        <defs>
          <marker id="nl-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={tokens.node.edge} />
          </marker>
          <marker id="nl-arrow-active" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={tokens.node.edgeActive} />
          </marker>
        </defs>

        {edges.map(({ from, to, active }) => {
          const s = layout[from];
          const t = layout[to];
          if (!s || !t) return null;
          return (
            <path
              key={`${from}->${to}`}
              d={edgePath(s, t)}
              fill="none"
              stroke={active ? tokens.node.edgeActive : tokens.node.edge}
              strokeWidth={active ? 2.5 : 1.5}
              markerEnd={`url(#${active ? "nl-arrow-active" : "nl-arrow"})`}
            />
          );
        })}

        {state.order.map((id) => {
          const p = layout[id];
          const node = state.nodes[id];
          if (!p || !node) return null;
          const visiting = state.visiting === id;
          const visited = state.visited.includes(id);
          const stroke = visiting ? tokens.node.visit : visited ? tokens.node.visited : tokens.node.stroke;
          return (
            <motion.g
              key={id}
              initial={{ opacity: 0, x: p.x, y: p.y }}
              animate={{ opacity: 1, x: p.x, y: p.y }}
              transition={{ duration }}
            >
              <motion.rect
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill={tokens.node.fill}
                animate={{ stroke, strokeWidth: visiting ? 3 : visited ? 2 : 1.5 }}
                transition={{ duration }}
              />
              <text
                x={NODE_W / 2}
                y={NODE_H / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill={tokens.node.text}
                fontSize="15"
                fontWeight="600"
              >
                {formatValue(node.value)}
              </text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}

function edgePath(s: Point, t: Point): string {
  if (Math.abs(s.y - t.y) < 4) {
    // same row (linked list)
    if (t.x > s.x) {
      return `M ${s.x + NODE_W} ${s.y + NODE_H / 2} L ${t.x} ${t.y + NODE_H / 2}`;
    }
    const x1 = s.x + NODE_W / 2;
    const x2 = t.x + NODE_W / 2;
    const cy = Math.min(s.y, t.y) - 34;
    return `M ${x1} ${s.y} Q ${(x1 + x2) / 2} ${cy} ${x2} ${t.y}`;
  }
  // parent -> child (tree): bottom-center of source to top-center of target
  return `M ${s.x + NODE_W / 2} ${s.y + NODE_H} L ${t.x + NODE_W / 2} ${t.y}`;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "·";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
