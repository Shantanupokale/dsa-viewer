import { motion } from "framer-motion";
import { tokens } from "../../theme/tokens";
import type { SceneProps } from "../types";
import type { SequenceKind, SequenceState, SequenceSubState } from "./state";

/**
 * Sequence renderer. Draws one labeled row per structure in the trace (arrays, strings,
 * stacks, queues, deques all share this scene, parameterized by which ends are "open").
 * The cell(s) touched by the most recent event glow: read=sky, write=amber, swap=purple,
 * push/pop=emerald. Transitions shorten at high speed but never disappear (PRD §12).
 */
export function SequenceScene({ state, speed }: SceneProps<SequenceState>) {
  const duration = Math.max(0.08, 0.4 / Math.max(0.25, speed));

  if (state.order.length === 0) {
    return <div className="text-sm text-slate-500">No structure yet — run a solution to begin.</div>;
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {state.order.map((id) => {
        const sub = state.byId[id];
        if (!sub) return null;
        return <StructureRow key={id} id={id} sub={sub} duration={duration} />;
      })}
    </div>
  );
}

function StructureRow({ id, sub, duration }: { id: string; sub: SequenceSubState; duration: number }) {
  const ends = endLabels(sub.kind);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="font-semibold text-slate-300">{id}</span>
        <span className="rounded bg-slate-800 px-1.5 py-0.5 uppercase tracking-wide">{sub.kind}</span>
      </div>
      <div className="flex items-end gap-3">
        {ends.left && <EndMarker label={ends.left} />}
        <div className="flex flex-wrap items-end gap-2">
          {sub.values.length === 0 ? (
            <span className="text-sm text-slate-600">empty</span>
          ) : (
            sub.values.map((value, i) => <Cell key={i} value={value} index={i} sub={sub} duration={duration} />)
          )}
        </div>
        {ends.right && <EndMarker label={ends.right} />}
      </div>
    </div>
  );
}

function Cell({
  value,
  index,
  sub,
  duration,
}: {
  value: unknown;
  index: number;
  sub: SequenceSubState;
  duration: number;
}) {
  const { border, glow, lift } = highlight(index, sub);
  const isActive = glow !== "none";
  const showIndex = sub.kind === "array" || sub.kind === "string";
  return (
    <div className="flex flex-col items-center gap-1">
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
      {showIndex && <span className="text-xs text-slate-500">{index}</span>}
    </div>
  );
}

function EndMarker({ label }: { label: string }) {
  return <span className="pb-5 text-xs font-medium text-slate-500">{label}</span>;
}

function highlight(i: number, sub: SequenceSubState): { border: string; glow: string; lift: number } {
  if (sub.swap && (sub.swap[0] === i || sub.swap[1] === i)) {
    return { border: tokens.cell.swap, glow: tokens.glow.swap, lift: -10 };
  }
  if (sub.write.includes(i)) return { border: tokens.cell.write, glow: tokens.glow.write, lift: 0 };
  if (sub.active.includes(i)) return { border: tokens.cell.active, glow: tokens.glow.active, lift: -6 };
  if (sub.read.includes(i)) return { border: tokens.cell.read, glow: tokens.glow.read, lift: 0 };
  return { border: tokens.cell.border, glow: "none", lift: 0 };
}

function endLabels(kind: SequenceKind): { left?: string; right?: string } {
  switch (kind) {
    case "stack":
      return { right: "top ▸" };
    case "queue":
      return { left: "front", right: "rear" };
    case "deque":
      return { left: "front", right: "back" };
    default:
      return {};
  }
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "·";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
