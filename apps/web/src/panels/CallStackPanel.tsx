import { AnimatePresence, motion } from "framer-motion";
import { usePlayer } from "../player/playerStore";

/**
 * Call-stack panel (PRD §7.4). Reconstructs the current call stack by folding
 * call_push/call_return over events[0..currentStep]. Deepest frame on top; indentation
 * mirrors recursion depth. Driven by the raw event stream, independent of the renderer,
 * so any recursive algorithm gets a call stack for free.
 */
export function CallStackPanel() {
  const events = usePlayer((s) => s.events);
  const currentStep = usePlayer((s) => s.currentStep);

  const stack: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const end = Math.min(currentStep, events.length - 1);
  for (let i = 0; i <= end; i++) {
    const e = events[i]!;
    if (e.type === "call_push") stack.push({ functionName: e.payload.functionName, args: e.payload.args });
    else if (e.type === "call_return") stack.pop();
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm">
      <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">Call stack ({stack.length})</div>
      {stack.length === 0 ? (
        <div className="text-slate-500">empty</div>
      ) : (
        <div className="flex flex-col-reverse gap-1">
          <AnimatePresence initial={false}>
            {stack.map((frame, i) => (
              <motion.div
                key={`${i}-${frame.functionName}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="rounded bg-slate-800 px-2 py-1 font-mono text-xs text-slate-200"
                style={{ marginLeft: i * 14 }}
              >
                {frame.functionName}({formatArgs(frame.args)})
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function formatArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .map(([k, v]) => `${k}=${typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)}`)
    .join(", ");
}
