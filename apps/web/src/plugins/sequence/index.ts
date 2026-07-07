import type { VisualizationPlugin } from "../types";
import { SequenceScene } from "./SequenceScene";
import { SEQUENCE_EMPTY, sequenceReduce, type SequenceState } from "./state";

/**
 * The Sequence plugin. Phase 0 wires array events; stack/queue/deque/string events
 * are listed as supported so Phase 1 only needs to extend the reducer + renderer,
 * not touch the registry or pipeline.
 */
export const sequencePlugin: VisualizationPlugin<SequenceState> = {
  name: "sequence",
  supportedEvents: [
    "array_init",
    "array_read",
    "array_write",
    "array_swap",
    // Phase 1 targets (reducer/renderer support to follow):
    "stack_push",
    "stack_pop",
    "queue_enqueue",
    "queue_dequeue",
    "deque_push_front",
    "deque_push_back",
    "deque_pop_front",
    "deque_pop_back",
  ],
  emptyState: SEQUENCE_EMPTY,
  reduce: sequenceReduce,
  renderer: SequenceScene,
  animationPresets: {
    array_read: { durationMs: 300, easing: "easeInOut", transitionType: "glow" },
    array_write: { durationMs: 400, easing: "easeInOut", transitionType: "scale" },
    array_swap: { durationMs: 450, easing: "easeInOut", transitionType: "bounce" },
  },
};
