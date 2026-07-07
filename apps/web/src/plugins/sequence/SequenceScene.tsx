import { motion } from "framer-motion";
import type { SceneProps } from "../types";
import { tokens } from "../../theme/tokens";
import type { SequenceState } from "./state";

/**
 * Sequence renderer (Phase 0: arrays). Draws a row of cells and animates the cell(s)
 * touched by the most recent event: reads glow sky, writes glow amber + value pops,
 * swaps glow purple + both cells lift. Always animates Before → After (PRD §12) —
 * transitions shorten at high speed but never disappear.
 */
export function SequenceScene({ state, speed }: SceneProps<SequenceState>) {
  const { values, read, write, swap } = state;

  const activeColor = (i: number): { border: string; glow: string; lift: number } => {
    if (swap && (swap[0] === i || swap[1] === i)) return { border: tokens.cell.swap, glow: tokens.glow.swap, lift: -10 };
    if (write.includes(i)) return { border: tokens.cell.write, glow: tokens.glow.write, lift: 0 };
    if (read.includes(i)) return { border: tokens.cell.read, glow: tokens.glow.read, lift: 0 };
    return { border: tokens.cell.border, glow: "none", lift: 0 };
  };

  // Shorten (never skip) transitions as speed rises.
  const duration = Math.max(0.08, 0.4 / Math.max(0.25, speed));

  if (values.length === 0) {
    return <div className="text-slate-500 text-sm">No structure yet — run a solution to begin.</div>;
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      {values.map((value, i) => {
        const { border, glow, lift } = activeColor(i);
        const isActive = glow !== "none";
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <motion.div
              className="flex h-14 w-14 items-center justify-center rounded-lg text-lg font-semibold"
              style={{ background: tokens.cell.base, color: tokens.cell.text, border: `2px solid ${border}` }}
              animate={{ boxShadow: glow, y: lift, scale: isActive ? 1.08 : 1 }}
              transition={{ duration, ease: "easeInOut" }}
            >
              <motion.span
                key={String(value)}
                initial={{ opacity: 0.3, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration }}
              >
                {formatValue(value)}
              </motion.span>
            </motion.div>
            <span className="text-xs text-slate-500">{i}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "·";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
