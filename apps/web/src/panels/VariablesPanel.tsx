import type { TraceEvent } from "@dsa/trace-schema";
import { usePlayer } from "../player/playerStore";

/**
 * Minimal current-step caption. This is NOT the deferred Explanation Engine — just a
 * one-line human-readable description of the current event to make the demo legible.
 */
export function VariablesPanel() {
  const events = usePlayer((s) => s.events);
  const currentStep = usePlayer((s) => s.currentStep);
  const event = currentStep >= 0 ? events[currentStep] : undefined;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm">
      <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">Current step</div>
      {event ? (
        <>
          <div className="text-slate-200">{describe(event)}</div>
          <div className="mt-1 font-mono text-xs text-slate-500">
            {event.type} · {event.structureId}
          </div>
        </>
      ) : (
        <div className="text-slate-500">Press Play or scrub to begin.</div>
      )}
    </div>
  );
}

function describe(e: TraceEvent): string {
  switch (e.type) {
    case "array_init":
      return `Initialize array with ${e.payload.length} elements.`;
    case "array_read":
      return `Read index ${e.payload.index} (value ${fmt(e.payload.value)}).`;
    case "array_write":
      return `Write ${fmt(e.payload.newValue)} at index ${e.payload.index} (was ${fmt(e.payload.oldValue)}).`;
    case "array_swap":
      return `Swap indices ${e.payload.indexA} and ${e.payload.indexB}.`;
    default:
      return e.type;
  }
}

function fmt(v: unknown): string {
  return typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);
}
