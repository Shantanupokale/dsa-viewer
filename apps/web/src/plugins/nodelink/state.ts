import type { TraceEvent } from "@dsa/trace-schema";

/**
 * Materialized state for the Node-link family. Phase 2 covers the singly-linked list:
 * nodes keyed by id, a `next` pointer map, plus which node is being visited and which
 * pointer most recently changed (so the renderer can highlight the traversal and the
 * flipped edge — e.g. during a list reversal).
 */
export interface NodeLinkNode {
  id: string;
  value: unknown;
}

export interface NodeLinkState {
  order: string[]; // creation order → drives linear layout
  nodes: Record<string, NodeLinkNode>;
  next: Record<string, string | null>;
  visiting: string | null;
  lastPointerFrom: string | null;
}

export const NODELINK_EMPTY: NodeLinkState = {
  order: [],
  nodes: {},
  next: {},
  visiting: null,
  lastPointerFrom: null,
};

/** Pure reducer. Never mutates its input. */
export function nodeLinkReduce(state: NodeLinkState, event: TraceEvent): NodeLinkState {
  switch (event.type) {
    case "linkedlist_init":
      return { ...NODELINK_EMPTY };

    case "linkedlist_node_create": {
      const { nodeId, value } = event.payload;
      if (state.nodes[nodeId]) return state;
      return {
        ...state,
        order: [...state.order, nodeId],
        nodes: { ...state.nodes, [nodeId]: { id: nodeId, value } },
        visiting: null,
        lastPointerFrom: null,
      };
    }

    case "linkedlist_pointer_update": {
      const { nodeId, targetNodeId } = event.payload;
      return {
        ...state,
        next: { ...state.next, [nodeId]: targetNodeId },
        visiting: null,
        lastPointerFrom: nodeId,
      };
    }

    case "linkedlist_traverse":
      return { ...state, visiting: event.payload.nodeId, lastPointerFrom: null };

    default:
      return state;
  }
}
