import type { ComponentType } from "react";
import type { EventType, TraceEvent } from "@dsa/trace-schema";

/** Motion recipe for one event type (PRD §10). */
export interface AnimationRecipe {
  durationMs: number;
  easing: string;
  transitionType: "move" | "fade" | "scale" | "glow" | "bounce";
}

/** Props every renderer receives. */
export interface SceneProps<TState> {
  state: TState;
  /** recipe for the most recently applied event, or null at the initial state */
  recipe: AnimationRecipe | null;
  /** current playback speed (0.25–8); renderers may shorten transitions at high speed */
  speed: number;
}

/**
 * A Visualization Plugin (PRD §10). Note: rather than PRD's `initialState(initEvent)`
 * we fold from a fixed `emptyState`, which subsumes init handling inside `reduce`
 * and makes snapshotting/replay uniform. Everything else matches the contract.
 */
export interface VisualizationPlugin<TState = unknown> {
  name: string;
  supportedEvents: EventType[];
  emptyState: TState;
  reduce: (state: TState, event: TraceEvent) => TState;
  renderer: ComponentType<SceneProps<TState>>;
  animationPresets: Partial<Record<EventType, AnimationRecipe>>;
}
