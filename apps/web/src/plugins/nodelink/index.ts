import type { VisualizationPlugin } from "../types";
import { NodeLinkScene } from "./NodeLinkScene";
import { NODELINK_EMPTY, nodeLinkReduce, type NodeLinkState } from "./state";

/**
 * The Node-link plugin. Phase 2 wires the singly-linked list; tree/graph/trie events
 * are listed as supported so M7 extends the reducer + layout, not the registry.
 */
export const nodeLinkPlugin: VisualizationPlugin<NodeLinkState> = {
  name: "node-link",
  supportedEvents: [
    "linkedlist_init",
    "linkedlist_node_create",
    "linkedlist_pointer_update",
    "linkedlist_traverse",
    "graph_init",
    "graph_add_node",
    "graph_add_edge",
    "node_visit",
    "edge_traverse",
    "backtrack",
    "trie_insert",
    "trie_visit",
  ],
  emptyState: NODELINK_EMPTY,
  reduce: nodeLinkReduce,
  renderer: NodeLinkScene,
  animationPresets: {
    linkedlist_node_create: { durationMs: 300, easing: "easeInOut", transitionType: "scale" },
    linkedlist_pointer_update: { durationMs: 400, easing: "easeInOut", transitionType: "move" },
    linkedlist_traverse: { durationMs: 300, easing: "easeInOut", transitionType: "glow" },
    graph_add_node: { durationMs: 300, easing: "easeInOut", transitionType: "scale" },
    graph_add_edge: { durationMs: 300, easing: "easeInOut", transitionType: "move" },
    node_visit: { durationMs: 300, easing: "easeInOut", transitionType: "glow" },
    edge_traverse: { durationMs: 350, easing: "easeInOut", transitionType: "move" },
    trie_insert: { durationMs: 300, easing: "easeInOut", transitionType: "scale" },
    trie_visit: { durationMs: 250, easing: "easeInOut", transitionType: "glow" },
  },
};
