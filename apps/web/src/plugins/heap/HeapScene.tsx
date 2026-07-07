import { motion } from "framer-motion";
import { tokens } from "../../theme/tokens";
import type { SceneProps } from "../types";
import type { HeapState } from "./state";

/**
 * Heap renderer. Draws the array-backed heap as a binary tree — node positions come
 * straight from index math (depth = ⌊log2(i+1)⌋), so no layout library is needed and
 * a swap animates as the two node circles gliding to each other's positions.
 * The just-pushed node glows emerald; swapping nodes glow purple.
 */
const R = 20; // node radius
const V_STEP = 66;

export function HeapScene({ state, speed }: SceneProps<HeapState>) {
  const duration = Math.max(0.1, 0.45 / Math.max(0.25, speed));
  const n = state.values.length;

  if (n === 0) {
    return (
      <div className="text-sm text-slate-500">
        {state.lastExtracted != null ? `Heap empty — last extracted ${String(state.lastExtracted)}.` : "No structure yet — run a solution to begin."}
      </div>
    );
  }

  const maxDepth = Math.floor(Math.log2(n));
  const leafSlots = 2 ** maxDepth;
  const width = Math.max(leafSlots * (R * 2 + 18), 200);
  const height = (maxDepth + 1) * V_STEP + R;

  // index -> center position, spreading each level evenly across the full width
  const pos = (i: number) => {
    const depth = Math.floor(Math.log2(i + 1));
    const inLevel = i - (2 ** depth - 1);
    const slots = 2 ** depth;
    return { x: ((inLevel + 0.5) * width) / slots, y: depth * V_STEP + R + 4 };
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height + 8} viewBox={`0 0 ${width} ${height + 8}`} className="max-w-none">
        {/* edges parent -> child */}
        {state.values.map((_, i) => {
          if (i === 0) return null;
          const p = pos(Math.floor((i - 1) / 2));
          const c = pos(i);
          return <line key={`e${i}`} x1={p.x} y1={p.y} x2={c.x} y2={c.y} stroke={tokens.node.edge} strokeWidth={1.5} />;
        })}

        {/* nodes — keyed by index; framer animates position changes on swap */}
        {state.values.map((v, i) => {
          const { x, y } = pos(i);
          const swapping = state.lastSwap !== null && (state.lastSwap[0] === i || state.lastSwap[1] === i);
          const pushed = state.lastPushed === i;
          const stroke = swapping ? tokens.cell.swap : pushed ? tokens.cell.active : tokens.node.stroke;
          return (
            <motion.g key={i} animate={{ x, y }} transition={{ duration, ease: "easeInOut" }} initial={false}>
              <motion.circle
                r={R}
                fill={tokens.node.fill}
                animate={{ stroke, strokeWidth: swapping || pushed ? 3 : 1.5 }}
                transition={{ duration }}
              />
              <motion.text
                key={String(v)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="14"
                fontWeight="600"
                fill={tokens.node.text}
                initial={{ opacity: 0.3 }}
                animate={{ opacity: 1 }}
                transition={{ duration }}
              >
                {String(v)}
              </motion.text>
            </motion.g>
          );
        })}
      </svg>
      {state.lastExtracted != null && (
        <div className="mt-1 text-xs text-amber-400">extracted: {String(state.lastExtracted)}</div>
      )}
    </div>
  );
}
