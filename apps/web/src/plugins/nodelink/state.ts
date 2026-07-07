import type { TraceEvent } from "@dsa/trace-schema";

/**
 * Materialized state for the Node-link family — covers the singly-linked list (linear
 * layout, `next` pointers) AND trees/graphs (structural `edges` + a layout hint).
 * `visiting`/`visited` track a traversal; `lastPointerFrom`/`lastEdge` mark the most
 * recent change so the renderer can highlight it.
 */
export type NodeLinkLayout = "linear" | "tree" | "force";

export interface NodeLinkNode {
  id: string;
  value: unknown;
}

export interface NodeLinkEdge {
  from: string;
  to: string;
}

export interface NodeLinkState {
  layout: NodeLinkLayout;
  order: string[];
  nodes: Record<string, NodeLinkNode>;
  next: Record<string, string | null>; // linked-list pointers (linear layout)
  edges: NodeLinkEdge[]; // structural edges (tree/force layout)
  visiting: string | null;
  visited: string[];
  lastPointerFrom: string | null;
  lastEdge: NodeLinkEdge | null;
}

export const NODELINK_EMPTY: NodeLinkState = {
  layout: "linear",
  order: [],
  nodes: {},
  next: {},
  edges: [],
  visiting: null,
  visited: [],
  lastPointerFrom: null,
  lastEdge: null,
};

const clearHighlights = (s: NodeLinkState): NodeLinkState => ({
  ...s,
  lastPointerFrom: null,
  lastEdge: null,
});

export function nodeLinkReduce(state: NodeLinkState, event: TraceEvent): NodeLinkState {
  switch (event.type) {
    // ---- linked list (linear) ----
    case "linkedlist_init":
      return { ...NODELINK_EMPTY, layout: "linear" };

    case "linkedlist_node_create": {
      const { nodeId, value } = event.payload;
      if (state.nodes[nodeId]) return state;
      return {
        ...clearHighlights(state),
        order: [...state.order, nodeId],
        nodes: { ...state.nodes, [nodeId]: { id: nodeId, value } },
        visiting: null,
      };
    }

    case "linkedlist_pointer_update":
      return {
        ...state,
        next: { ...state.next, [event.payload.nodeId]: event.payload.targetNodeId },
        visiting: null,
        lastPointerFrom: event.payload.nodeId,
        lastEdge: null,
      };

    case "linkedlist_traverse":
      return { ...clearHighlights(state), visiting: event.payload.nodeId };

    // ---- tree / graph ----
    case "graph_init":
      return { ...NODELINK_EMPTY, layout: event.payload.layout ?? "force" };

    case "graph_add_node": {
      const { nodeId, value } = event.payload;
      if (state.nodes[nodeId]) return state;
      return {
        ...clearHighlights(state),
        order: [...state.order, nodeId],
        nodes: { ...state.nodes, [nodeId]: { id: nodeId, value: value ?? nodeId } },
      };
    }

    case "graph_add_edge":
      return {
        ...clearHighlights(state),
        edges: [...state.edges, { from: event.payload.fromNodeId, to: event.payload.toNodeId }],
      };

    case "node_visit": {
      const prev = state.visiting;
      const visited = prev && !state.visited.includes(prev) ? [...state.visited, prev] : state.visited;
      return { ...clearHighlights(state), visiting: event.payload.nodeId, visited };
    }

    case "edge_traverse":
      return {
        ...state,
        lastEdge: { from: event.payload.fromNodeId, to: event.payload.toNodeId },
        lastPointerFrom: null,
        visiting: event.payload.toNodeId,
      };

    default:
      return state;
  }
}
