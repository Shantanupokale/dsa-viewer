import type { VisualizationPlugin } from "../types";
import { SequenceScene } from "./SequenceScene";
import { SEQUENCE_EMPTY, sequenceReduce, type SequenceState } from "./state";

/** The Sequence plugin — array, string, stack, queue, deque all share this renderer. */
export const sequencePlugin: VisualizationPlugin<SequenceState> = {
  name: "sequence",
  supportedEvents: [
    "array_init",
    "array_read",
    "array_write",
    "array_swap",
    "string_init",
    "string_compare",
    "stack_push",
    "stack_pop",
    "stack_peek",
    "queue_enqueue",
    "queue_dequeue",
    "queue_peek",
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
    string_compare: { durationMs: 300, easing: "easeInOut", transitionType: "glow" },
    stack_push: { durationMs: 350, easing: "easeInOut", transitionType: "bounce" },
    stack_pop: { durationMs: 350, easing: "easeInOut", transitionType: "fade" },
    queue_enqueue: { durationMs: 350, easing: "easeInOut", transitionType: "bounce" },
    queue_dequeue: { durationMs: 350, easing: "easeInOut", transitionType: "fade" },
    deque_push_front: { durationMs: 350, easing: "easeInOut", transitionType: "bounce" },
    deque_push_back: { durationMs: 350, easing: "easeInOut", transitionType: "bounce" },
    deque_pop_front: { durationMs: 350, easing: "easeInOut", transitionType: "fade" },
    deque_pop_back: { durationMs: 350, easing: "easeInOut", transitionType: "fade" },
  },
};
