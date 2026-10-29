import type { CanvasFlowNode } from "./canvas-store";

export function canvasNodeAbsolutePosition(
  node: CanvasFlowNode,
  byId: Map<string, CanvasFlowNode>,
): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
  let parentId = node.parentId;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) {
      break;
    }
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId;
  }
  return { x, y };
}
