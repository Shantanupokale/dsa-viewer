import type { TraceEvent } from "@dsa/trace-schema";
import { create } from "zustand";
import type { VisualizationPlugin } from "../plugins/types";

/**
 * Replay Engine (PRD §9.2). Holds the event stream and playback state, and
 * materializes structure state at any step. `seekTo`/`materialize` fold forward from
 * the nearest snapshot (every SNAPSHOT_INTERVAL events) instead of replaying from 0,
 * which is what keeps scrubbing 50k-event traces fast (PRD §9.3 / NFR1).
 */
const SNAPSHOT_INTERVAL = 100;
const BASE_STEP_MS = 650;

let timer: ReturnType<typeof setInterval> | null = null;
function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export interface PlayerState {
  events: TraceEvent[];
  plugin: VisualizationPlugin | null;
  snapshots: Map<number, unknown>;
  currentStep: number; // -1 = before the first event
  isPlaying: boolean;
  speed: number;

  load: (events: TraceEvent[], plugin: VisualizationPlugin) => void;
  reset: () => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  seekTo: (step: number) => void;
  setSpeed: (speed: number) => void;
  /** Structure state after applying events[0..step] (step < 0 => empty state). */
  materialize: (step: number) => unknown;
}

export const usePlayer = create<PlayerState>((set, get) => {
  function startTimer() {
    stopTimer();
    const { speed } = get();
    timer = setInterval(() => {
      const { currentStep, events } = get();
      if (currentStep >= events.length - 1) {
        stopTimer();
        set({ isPlaying: false });
        return;
      }
      set({ currentStep: currentStep + 1 });
    }, BASE_STEP_MS / speed);
  }

  return {
    events: [],
    plugin: null,
    snapshots: new Map(),
    currentStep: -1,
    isPlaying: false,
    speed: 1,

    load: (events, plugin) => {
      stopTimer();
      const snapshots = new Map<number, unknown>();
      let state = plugin.emptyState;
      for (let i = 0; i < events.length; i++) {
        state = plugin.reduce(state, events[i]!);
        if ((i + 1) % SNAPSHOT_INTERVAL === 0) snapshots.set(i, state);
      }
      set({ events, plugin, snapshots, currentStep: -1, isPlaying: false });
    },

    reset: () => {
      stopTimer();
      set({ events: [], snapshots: new Map(), currentStep: -1, isPlaying: false });
    },

    play: () => {
      const { events, currentStep } = get();
      if (events.length === 0) return;
      if (currentStep >= events.length - 1) set({ currentStep: -1 }); // replay from start
      set({ isPlaying: true });
      startTimer();
    },
    pause: () => {
      stopTimer();
      set({ isPlaying: false });
    },
    toggle: () => {
      if (get().isPlaying) get().pause();
      else get().play();
    },

    stepForward: () => {
      get().pause();
      const { currentStep, events } = get();
      if (currentStep < events.length - 1) set({ currentStep: currentStep + 1 });
    },
    stepBackward: () => {
      get().pause();
      const { currentStep } = get();
      if (currentStep > -1) set({ currentStep: currentStep - 1 });
    },
    seekTo: (step) => {
      get().pause();
      const { events } = get();
      set({ currentStep: Math.max(-1, Math.min(step, events.length - 1)) });
    },
    setSpeed: (speed) => {
      set({ speed });
      if (get().isPlaying) startTimer();
    },

    materialize: (step) => {
      const { events, plugin, snapshots } = get();
      if (!plugin) return null;
      if (step < 0 || events.length === 0) return plugin.emptyState;

      const clamped = Math.min(step, events.length - 1);
      const snapStep = Math.floor((clamped + 1) / SNAPSHOT_INTERVAL) * SNAPSHOT_INTERVAL - 1;

      let state = plugin.emptyState;
      let from = 0;
      if (snapStep >= 0 && snapshots.has(snapStep)) {
        state = snapshots.get(snapStep)!;
        from = snapStep + 1;
      }
      for (let i = from; i <= clamped; i++) state = plugin.reduce(state, events[i]!);
      return state;
    },
  };
});
