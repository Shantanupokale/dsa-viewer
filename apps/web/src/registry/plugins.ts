import { nodeLinkPlugin } from "../plugins/nodelink";
import { sequencePlugin } from "../plugins/sequence";
import type { VisualizationPlugin } from "../plugins/types";

/** name -> plugin. Adding a renderer family = adding one entry here. */
export const plugins: Record<string, VisualizationPlugin> = {
  // Cast through unknown: a plugin typed over its own state is intentionally erased to
  // the registry's VisualizationPlugin<unknown> (renderer prop variance requires it).
  [sequencePlugin.name]: sequencePlugin as unknown as VisualizationPlugin,
  [nodeLinkPlugin.name]: nodeLinkPlugin as unknown as VisualizationPlugin,
};

export function getPlugin(name: string): VisualizationPlugin | null {
  return plugins[name] ?? null;
}
