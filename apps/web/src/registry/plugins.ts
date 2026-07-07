import { heapPlugin } from "../plugins/heap";
import { nodeLinkPlugin } from "../plugins/nodelink";
import { sequencePlugin } from "../plugins/sequence";
import { tablePlugin } from "../plugins/table";
import type { VisualizationPlugin } from "../plugins/types";

/** name -> plugin. Adding a renderer family = adding one entry here. */
export const plugins: Record<string, VisualizationPlugin> = {
  // Cast through unknown: a plugin typed over its own state is intentionally erased to
  // the registry's VisualizationPlugin<unknown> (renderer prop variance requires it).
  [sequencePlugin.name]: sequencePlugin as unknown as VisualizationPlugin,
  [nodeLinkPlugin.name]: nodeLinkPlugin as unknown as VisualizationPlugin,
  [tablePlugin.name]: tablePlugin as unknown as VisualizationPlugin,
  [heapPlugin.name]: heapPlugin as unknown as VisualizationPlugin,
};

export function getPlugin(name: string): VisualizationPlugin | null {
  return plugins[name] ?? null;
}

/**
 * Pick the renderer from what the trace actually contains — event-type prefix →
 * plugin family. Makes visualization correct for pasted/AI-rewritten code regardless
 * of which example is selected. First matching structural event wins.
 */
const PREFIX_TO_PLUGIN: Array<[string, string]> = [
  ["heap_", "heap"],
  ["dp_", "table"],
  ["segtree_", "table"],
  ["linkedlist_", "node-link"],
  ["graph_", "node-link"],
  ["node_", "node-link"],
  ["edge_", "node-link"],
  ["tree_", "node-link"],
  ["trie_", "node-link"],
  ["backtrack", "node-link"],
  ["array_", "sequence"],
  ["string_", "sequence"],
  ["pointer_", "sequence"],
  ["stack_", "sequence"],
  ["queue_", "sequence"],
  ["deque_", "sequence"],
  ["window_", "sequence"],
];

export function pluginForEvents(events: Array<{ type: string }>): VisualizationPlugin | null {
  for (const e of events) {
    for (const [prefix, name] of PREFIX_TO_PLUGIN) {
      if (e.type.startsWith(prefix)) return getPlugin(name);
    }
  }
  return null;
}
