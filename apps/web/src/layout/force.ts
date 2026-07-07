import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { NODE_H, NODE_W, type Layout } from "./linear";

/**
 * Force-directed layout via d3-force. Runs the simulation synchronously (fixed number
 * of ticks) and returns final positions — the scene memoizes this by node/edge set, so
 * it recomputes only when the graph's structure changes, not on every playback step.
 *
 * Nodes are seeded deterministically on a circle so the result is stable across
 * recomputes (no random initial placement).
 */
interface SimNode extends SimulationNodeDatum {
  id: string;
}

const TICKS = 300;
const PAD = 10;

export function forceLayout(
  nodeIds: string[],
  edges: Array<{ from: string; to: string }>,
): { layout: Layout; width: number; height: number } {
  if (nodeIds.length === 0) return { layout: {}, width: 0, height: 0 };

  const radius = 40 + nodeIds.length * 14;
  const nodes: SimNode[] = nodeIds.map((id, i) => {
    const angle = (2 * Math.PI * i) / nodeIds.length;
    return { id, x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });
  const present = new Set(nodeIds);
  const links: Array<SimulationLinkDatum<SimNode>> = edges
    .filter((e) => present.has(e.from) && present.has(e.to))
    .map((e) => ({ source: e.from, target: e.to }));

  const sim = forceSimulation<SimNode>(nodes)
    .force("charge", forceManyBody().strength(-240))
    .force("link", forceLink<SimNode, SimulationLinkDatum<SimNode>>(links).id((d) => d.id).distance(96))
    .force("center", forceCenter(0, 0))
    .force("collide", forceCollide(NODE_W * 0.7))
    .stop();
  sim.tick(TICKS);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x ?? 0);
    minY = Math.min(minY, n.y ?? 0);
    maxX = Math.max(maxX, n.x ?? 0);
    maxY = Math.max(maxY, n.y ?? 0);
  }

  const layout: Layout = {};
  for (const n of nodes) {
    layout[n.id] = { x: (n.x ?? 0) - minX + PAD, y: (n.y ?? 0) - minY + PAD };
  }

  return {
    layout,
    width: maxX - minX + NODE_W + 2 * PAD,
    height: maxY - minY + NODE_H + 2 * PAD,
  };
}
