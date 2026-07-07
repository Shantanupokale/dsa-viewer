import type { VisualizationPlugin } from "../types";
import { HeapScene } from "./HeapScene";
import { HEAP_EMPTY, heapReduce, type HeapState } from "./state";

/** The Heap plugin — array-backed min-heap drawn as a binary tree. */
export const heapPlugin: VisualizationPlugin<HeapState> = {
  name: "heap",
  supportedEvents: ["heap_init", "heap_push", "heap_swap", "heap_extract"],
  emptyState: HEAP_EMPTY,
  reduce: heapReduce,
  renderer: HeapScene,
  animationPresets: {
    heap_push: { durationMs: 300, easing: "easeInOut", transitionType: "scale" },
    heap_swap: { durationMs: 450, easing: "easeInOut", transitionType: "move" },
    heap_extract: { durationMs: 400, easing: "easeInOut", transitionType: "fade" },
  },
};
