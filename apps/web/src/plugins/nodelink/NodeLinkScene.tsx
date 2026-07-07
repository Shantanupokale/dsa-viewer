import { motion } from "framer-motion";
import { linearBounds, linearLayout, NODE_H, NODE_W, type Point } from "../../layout/linear";
import { tokens } from "../../theme/tokens";
import type { SceneProps } from "../types";
import type { NodeLinkState } from "./state";

/**
 * Node-link renderer (Phase 2: singly-linked list, linear layout). Nodes are placed in
 * creation order; `next` pointers are drawn as arrows (forward = straight, backward =
 * arc above, so a list reversal is visible). The visited node glows; the pointer that
 * just changed is drawn in amber.
 */
export function NodeLinkScene({ state, speed }: SceneProps<NodeLinkState>) {
  const duration = Math.max(0.1, 0.4 / Math.max(0.25, speed));

  if (state.order.length === 0) {
    return <div className="text-sm text-slate-500">No structure yet — run a solution to begin.</div>;
  }

  const layout = linearLayout(state.order);
  const { width, height } = linearBounds(state.order.length);

  const edges = state.order
    .map((id) => ({ id, target: state.next[id] ?? null }))
    .filter((e): e is { id: string; target: string } => e.target !== null && layout[e.target] !== undefined);

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width + 16} height={height} viewBox={`-8 0 ${width + 16} ${height}`} className="max-w-none">
        <defs>
          <marker id="nl-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={tokens.node.edge} />
          </marker>
          <marker id="nl-arrow-active" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={tokens.node.edgeActive} />
          </marker>
        </defs>

        {edges.map(({ id, target }) => {
          const active = state.lastPointerFrom === id;
          return (
            <path
              key={id}
              d={edgePath(layout[id]!, layout[target]!)}
              fill="none"
              stroke={active ? tokens.node.edgeActive : tokens.node.edge}
              strokeWidth={active ? 2.5 : 1.5}
              markerEnd={`url(#${active ? "nl-arrow-active" : "nl-arrow"})`}
            />
          );
        })}

        {state.order.map((id) => {
          const p = layout[id]!;
          const node = state.nodes[id]!;
          const visiting = state.visiting === id;
          return (
            <g key={id} transform={`translate(${p.x} ${p.y})`}>
              <motion.rect
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill={tokens.node.fill}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  stroke: visiting ? tokens.node.visit : tokens.node.stroke,
                  strokeWidth: visiting ? 3 : 1.5,
                }}
                transition={{ duration }}
                style={{ transformOrigin: `${NODE_W / 2}px ${NODE_H / 2}px` }}
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
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function edgePath(s: Point, t: Point): string {
  if (t.x > s.x) {
    // forward pointer — straight arrow, right edge to left edge
    const x1 = s.x + NODE_W;
    const y1 = s.y + NODE_H / 2;
    return `M ${x1} ${y1} L ${t.x} ${t.y + NODE_H / 2}`;
  }
  // back pointer (e.g. after reversal) — arc above the row
  const x1 = s.x + NODE_W / 2;
  const y1 = s.y;
  const x2 = t.x + NODE_W / 2;
  const y2 = t.y;
  const cx = (x1 + x2) / 2;
  const cy = Math.min(y1, y2) - 34;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "·";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
