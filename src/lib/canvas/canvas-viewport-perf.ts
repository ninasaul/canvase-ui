import { getNodeIndex } from "./canvas-node-index";
import { canvasNodeAbsolutePosition } from "./canvas-node-position";
import type { CanvasFlowNode } from "./canvas-store";

/** Disable edge dash animation when the graph has more than this many edges. */
export const CANVAS_EDGE_ANIMATION_MAX = 80;

export type CanvasViewportSnapshot = {
  x: number;
  y: number;
  zoom: number;
};

export function shouldAnimateCanvasEdges(
  preferAnimation: boolean,
  edgeCount: number,
): boolean {
  return preferAnimation && edgeCount <= CANVAS_EDGE_ANIMATION_MAX;
}

/**
 * Nodes whose screen-space bounds intersect the pane (with padding).
 * Uses absolute positions so grouped children are culled correctly.
 */
export function collectVisibleCanvasNodeIds(
  nodes: readonly CanvasFlowNode[],
  viewport: CanvasViewportSnapshot,
  width: number,
  height: number,
  padding = 80,
): string[] {
  if (width <= 0 || height <= 0 || nodes.length === 0) {
    return [];
  }
  const byId = getNodeIndex(nodes);
  const visible: string[] = [];
  for (const node of nodes) {
    const position = canvasNodeAbsolutePosition(node, byId);
    const left = viewport.x + position.x * viewport.zoom;
    const top = viewport.y + position.y * viewport.zoom;
    const right =
      left + (node.width ?? node.measured?.width ?? 280) * viewport.zoom;
    const bottom =
      top + (node.height ?? node.measured?.height ?? 200) * viewport.zoom;
    if (
      right > -padding &&
      bottom > -padding &&
      left < width + padding &&
      top < height + padding
    ) {
      visible.push(node.id);
    }
  }
  return visible;
}

export function sameStringSet(
  left: ReadonlySet<string>,
  right: readonly string[],
): boolean {
  if (left.size !== right.length) {
    return false;
  }
  for (const id of right) {
    if (!left.has(id)) {
      return false;
    }
  }
  return true;
}
