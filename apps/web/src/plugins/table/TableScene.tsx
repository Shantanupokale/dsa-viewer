import { motion } from "framer-motion";
import { tokens } from "../../theme/tokens";
import type { SceneProps } from "../types";
import type { CellRef, TableState } from "./state";

/**
 * Table renderer (Phase 4: DP tables). An SVG grid — reads glow sky, the just-written
 * cell glows amber and its value pops, and dependency arrows animate from each source
 * cell into the written cell (the "where did this value come from" of DP).
 */
const CELL = 44;
const GAP = 6;
const LABEL = 26; // row/col index gutters

export function TableScene({ state, speed }: SceneProps<TableState>) {
  const duration = Math.max(0.08, 0.4 / Math.max(0.25, speed));

  if (state.rows === 0) {
    return <div className="text-sm text-slate-500">No structure yet — run a solution to begin.</div>;
  }

  const width = LABEL + state.cols * (CELL + GAP);
  const height = LABEL + state.rows * (CELL + GAP);
  const cx = (c: CellRef) => LABEL + c.col * (CELL + GAP) + CELL / 2;
  const cy = (c: CellRef) => LABEL + c.row * (CELL + GAP) + CELL / 2;

  return (
    <div className="w-full overflow-auto">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="max-w-none">
        <defs>
          <marker id="dep-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill={tokens.cell.write} />
          </marker>
        </defs>

        {/* column indices */}
        {Array.from({ length: state.cols }, (_, c) => (
          <text key={`c${c}`} x={LABEL + c * (CELL + GAP) + CELL / 2} y={LABEL - 10} textAnchor="middle" fontSize="11" fill="#64748b">
            {c}
          </text>
        ))}
        {/* row indices */}
        {Array.from({ length: state.rows }, (_, r) => (
          <text key={`r${r}`} x={LABEL - 10} y={LABEL + r * (CELL + GAP) + CELL / 2} textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#64748b">
            {r}
          </text>
        ))}

        {/* cells */}
        {state.values.map((rowVals, r) =>
          rowVals.map((v, c) => {
            const isWrite = state.write?.row === r && state.write?.col === c;
            const isRead = state.read?.row === r && state.read?.col === c;
            const isDep = state.deps.some((d) => d.row === r && d.col === c);
            const stroke = isWrite ? tokens.cell.write : isRead ? tokens.cell.read : isDep ? tokens.cell.active : tokens.cell.border;
            return (
              <g key={`${r}-${c}`} transform={`translate(${LABEL + c * (CELL + GAP)} ${LABEL + r * (CELL + GAP)})`}>
                <motion.rect
                  width={CELL}
                  height={CELL}
                  rx={6}
                  fill={tokens.cell.base}
                  animate={{ stroke, strokeWidth: isWrite || isRead || isDep ? 2.5 : 1 }}
                  transition={{ duration }}
                />
                <motion.text
                  key={String(v)}
                  x={CELL / 2}
                  y={CELL / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="14"
                  fontWeight="600"
                  fill={tokens.cell.text}
                  initial={{ opacity: 0.3, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration }}
                  style={{ transformOrigin: `${CELL / 2}px ${CELL / 2}px` }}
                >
                  {formatValue(v)}
                </motion.text>
              </g>
            );
          }),
        )}

        {/* dependency arrows into the just-written cell */}
        {state.write &&
          state.deps.map((d, i) => (
            <motion.path
              key={`dep-${i}`}
              d={`M ${cx(d)} ${cy(d)} L ${cx(state.write!)} ${cy(state.write!)}`}
              fill="none"
              stroke={tokens.cell.write}
              strokeWidth={2}
              markerEnd="url(#dep-arrow)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.9 }}
              transition={{ duration }}
            />
          ))}
      </svg>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "·";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
