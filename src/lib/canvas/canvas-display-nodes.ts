import type { CanvasFlowNode } from "./canvas-store";

/**
 * Merge store nodes into the React Flow display buffer without forcing a new
 * array when every node identity already matches.
 *
 * - Structural mismatch (length / id order) → adopt `store` wholesale.
 * - Same ids: reuse `display[i]` when it is the same reference as `store[i]`;
 *   otherwise take the store node (data / selection / size updates).
 * - No element changes → return `display` so React can skip the state update.
 *
 * Ported from the tu_api canvas: the graph component keeps a local display
 * buffer and only adopts store nodes that actually changed, so a prompt edit on
 * one node keeps the other 100+ node identities intact.
 */
export function reconcileCanvasDisplayNodes(
  display: readonly CanvasFlowNode[],
  store: readonly CanvasFlowNode[],
): CanvasFlowNode[] {
  if (display === store) {
    return store as CanvasFlowNode[];
  }
  if (display.length !== store.length) {
    return store as CanvasFlowNode[];
  }

  let anyChange = false;
  const next: CanvasFlowNode[] = new Array(store.length);
  for (let index = 0; index < store.length; index += 1) {
    const storeNode = store[index]!;
    const displayNode = display[index];
    if (!displayNode || displayNode.id !== storeNode.id) {
      return store as CanvasFlowNode[];
    }
    if (displayNode === storeNode) {
      next[index] = displayNode;
    } else {
      next[index] = storeNode;
      anyChange = true;
    }
  }

  return anyChange ? next : (display as CanvasFlowNode[]);
}
