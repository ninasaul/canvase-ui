import type { CanvasFlowNode } from "@/lib/canvas/canvas-store";

/**
 * Per-array node index.
 *
 * Node components subscribe with `state.nodes` lookups; a plain
 * `nodes.find(...)` runs once per mounted node on every store update, which is
 * O(n²) on a large canvas (164 nodes → ~27k comparisons per drag frame). The
 * index is cached against the array identity, so each store update pays O(n)
 * once and every component then does an O(1) lookup.
 */
const indexCache = new WeakMap<
  readonly CanvasFlowNode[],
  Map<string, CanvasFlowNode>
>();

function indexOf(
  nodes: readonly CanvasFlowNode[],
): Map<string, CanvasFlowNode> {
  const cached = indexCache.get(nodes);
  if (cached) {
    return cached;
  }
  const index = new Map<string, CanvasFlowNode>();
  for (const node of nodes) {
    index.set(node.id, node);
  }
  indexCache.set(nodes, index);
  return index;
}

export function getNodeById(
  nodes: readonly CanvasFlowNode[],
  nodeId: string,
): CanvasFlowNode | undefined {
  return indexOf(nodes).get(nodeId);
}
