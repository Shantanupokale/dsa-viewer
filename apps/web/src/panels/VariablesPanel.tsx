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
    case "string_init":
      return `Initialize string of length ${e.payload.length}.`;
    case "string_compare":
      return `Compare index ${e.payload.indexA} ('${e.payload.charA}') with ${e.payload.indexB} ('${e.payload.charB}') → ${e.payload.isMatch ? "match" : "differ"}.`;
    case "stack_push":
      return `Push ${fmt(e.payload.value)} onto the stack.`;
    case "stack_pop":
      return `Pop ${fmt(e.payload.value)} off the stack.`;
    case "stack_peek":
      return `Peek top of stack (${fmt(e.payload.value)}).`;
    case "queue_enqueue":
      return `Enqueue ${fmt(e.payload.value)} at the rear.`;
    case "queue_dequeue":
      return `Dequeue ${fmt(e.payload.value)} from the front.`;
    case "queue_peek":
      return `Peek front of queue (${fmt(e.payload.value)}).`;
    case "deque_push_front":
      return `Push ${fmt(e.payload.value)} to the front.`;
    case "deque_push_back":
      return `Push ${fmt(e.payload.value)} to the back.`;
    case "deque_pop_front":
      return `Pop ${fmt(e.payload.value)} from the front.`;
    case "deque_pop_back":
      return `Pop ${fmt(e.payload.value)} from the back.`;
    case "linkedlist_init":
      return `Create a linked list.`;
    case "linkedlist_node_create":
      return `Create node ${e.payload.nodeId} (value ${fmt(e.payload.value)}).`;
    case "linkedlist_pointer_update":
      return `Set ${e.payload.nodeId}.next → ${e.payload.targetNodeId ?? "null"}.`;
    case "linkedlist_traverse":
      return `Visit node ${e.payload.nodeId}.`;
    case "graph_init":
      return `Create a ${e.payload.layout === "tree" ? "tree" : "graph"}.`;
    case "graph_add_node":
      return `Add node ${e.payload.nodeId}${e.payload.value !== undefined ? ` (value ${fmt(e.payload.value)})` : ""}.`;
    case "graph_add_edge":
      return `Add edge ${e.payload.fromNodeId} → ${e.payload.toNodeId}.`;
    case "node_visit":
      return `Visit node ${e.payload.nodeId}.`;
    case "edge_traverse":
      return `Traverse edge ${e.payload.fromNodeId} → ${e.payload.toNodeId}.`;
    case "dp_init":
      return `Create a ${e.payload.rows}×${e.payload.cols} DP table.`;
    case "dp_cell_read":
      return `Read dp[${e.payload.row}][${e.payload.col}] (${fmt(e.payload.value)}).`;
    case "dp_cell_write": {
      const deps = e.payload.dependsOn?.map((d) => `dp[${d.row}][${d.col}]`).join(", ");
      return `Write ${fmt(e.payload.newValue)} to dp[${e.payload.row}][${e.payload.col}]${deps ? ` (from ${deps})` : ""}.`;
    }
    case "heap_init":
      return `Create a min-heap.`;
    case "heap_push":
      return `Push ${fmt(e.payload.value)} into the heap.`;
    case "heap_swap":
      return `Sift: swap positions ${e.payload.indexA} and ${e.payload.indexB}.`;
    case "heap_extract":
      return `Extract min ${fmt(e.payload.value)} from the top.`;
    case "trie_insert":
      return e.payload.parentNodeId == null
        ? `Create trie root.`
        : `Insert '${e.payload.char}' under ${e.payload.parentNodeId}${e.payload.isWordEnd ? " (word end)" : ""}.`;
    case "trie_visit":
      return `Follow existing node ${e.payload.nodeId}.`;
    case "call_push": {
      const args = Object.entries(e.payload.args).map(([k, v]) => `${k}=${fmt(v)}`).join(", ");
      return `Call ${e.payload.functionName}(${args}).`;
    }
    case "call_return":
      return `Return from ${e.payload.functionName}.`;
    default:
      return e.type;
  }
}

function fmt(v: unknown): string {
  return typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);
}
