import type { EventType } from "@dsa/trace-schema";
import type { AnimationRecipe, VisualizationPlugin } from "../plugins/types";

const DEFAULT_RECIPE: AnimationRecipe = { durationMs: 300, easing: "easeInOut", transitionType: "fade" };

/**
 * Resolve the motion recipe for an event: the plugin's preset for that type, or a
 * safe default. Renderers use it to drive the Before → Transition → After lifecycle.
 */
export function recipeFor(
  plugin: VisualizationPlugin | null,
  eventType: EventType | null,
): AnimationRecipe | null {
  if (!plugin || !eventType) return null;
  return plugin.animationPresets[eventType] ?? DEFAULT_RECIPE;
}
