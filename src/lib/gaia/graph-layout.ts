/**
 * Gaïa — Phase 2 "Graph": radial BFS layout (pure functions, no dependency).
 *
 * Nodes are placed in rings around the most-connected note: ring 0 is the
 * center, ring 1 its direct neighbours, ring 2 their neighbours, and so
 * on. Disconnected components start a new BFS from their own most-connected
 * node on the next free ring, so every node gets a position. Isolated
 * notes (no edges at all) land on the outermost ring.
 *
 * Ring radius is 260px; nodes on a ring are evenly spaced with a small
 * per-ring rotation so labels rarely line up across rings.
 */

export type GraphLayoutNode = { id: string };
export type GraphLayoutEdge = { from: string; to: string };
export type GraphPosition = { x: number; y: number };

const RING_RADIUS = 260;

export function layoutGraph(
  nodes: GraphLayoutNode[],
  edges: GraphLayoutEdge[],
): Map<string, GraphPosition> {
  const positions = new Map<string, GraphPosition>();
  if (nodes.length === 0) return positions;
  if (nodes.length === 1) {
    positions.set(nodes[0].id, { x: 0, y: 0 });
    return positions;
  }

  // Undirected adjacency (deduplicated, self-loops dropped).
  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) adjacency.set(node.id, new Set());
  for (const edge of edges) {
    if (edge.from === edge.to) continue;
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  }
  const degree = (id: string): number => adjacency.get(id)?.size ?? 0;

  // Rings: ring number per node id. BFS from the highest-degree node;
  // when a component is exhausted, start a new BFS on the next ring.
  const ringOf = new Map<string, number>();
  let ring = 0;
  const unplaced = new Set(nodes.map((n) => n.id));
  while (unplaced.size > 0) {
    const start = [...unplaced].sort((a, b) => degree(b) - degree(a))[0];
    const queue: string[] = [start];
    ringOf.set(start, ring);
    unplaced.delete(start);
    while (queue.length > 0) {
      const current = queue.shift() as string;
      const currentRing = ringOf.get(current) as number;
      for (const neighbour of adjacency.get(current) ?? []) {
        if (ringOf.has(neighbour)) continue;
        ringOf.set(neighbour, currentRing + 1);
        unplaced.delete(neighbour);
        queue.push(neighbour);
      }
    }
    ring = Math.max(...ringOf.values()) + 1;
  }

  // Group node ids per ring, then place them evenly on the circle.
  const byRing = new Map<number, string[]>();
  for (const [id, r] of ringOf) {
    const list = byRing.get(r) ?? [];
    list.push(id);
    byRing.set(r, list);
  }
  for (const [r, ids] of byRing) {
    const radius = RING_RADIUS * r;
    const offset = r * 0.6; // rotate each ring so labels don't align
    ids.forEach((id, i) => {
      if (r === 0) {
        positions.set(id, { x: 0, y: 0 });
        return;
      }
      const angle = offset + (2 * Math.PI * i) / ids.length;
      positions.set(id, {
        x: Math.round(radius * Math.cos(angle)),
        y: Math.round(radius * Math.sin(angle)),
      });
    });
  }
  return positions;
}
