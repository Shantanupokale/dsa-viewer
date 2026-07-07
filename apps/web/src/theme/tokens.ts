/**
 * Design tokens. Renderers read colors from here — never hardcode (ARCHITECTURE §4).
 * Phase 0 ships the dark palette; light/high-contrast slot in later behind the same keys.
 */
export const tokens = {
  cell: {
    base: "#1e293b", // slate-800
    border: "#334155", // slate-700
    text: "#e2e8f0", // slate-200
    read: "#0ea5e9", // sky-500  — being read
    write: "#f59e0b", // amber-500 — just written
    swap: "#a855f7", // purple-500 — swapping
    active: "#10b981", // emerald-500 — just pushed/popped/enqueued/dequeued
  },
  glow: {
    read: "0 0 0 2px #0ea5e9, 0 0 16px #0ea5e955",
    write: "0 0 0 2px #f59e0b, 0 0 16px #f59e0b55",
    swap: "0 0 0 2px #a855f7, 0 0 16px #a855f755",
    active: "0 0 0 2px #10b981, 0 0 16px #10b98155",
  },
  node: {
    fill: "#1e293b", // slate-800
    stroke: "#475569", // slate-600
    text: "#e2e8f0", // slate-200
    visit: "#10b981", // emerald-500 — currently visiting
    visited: "#0d9488", // teal-600 — already visited
    edge: "#64748b", // slate-500
    edgeActive: "#f59e0b", // amber-500 — pointer/edge just changed
  },
} as const;
