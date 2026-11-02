import type { CanvasSettings } from "@/lib/tu-shared-browser";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/canvas-store";

/** Snapshot used to decide whether the graph actually changed. */
export type CanvasGraphObservation = {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  settings: CanvasSettings;
  title: string;
};

export function sameGraphObservation(
  previous: CanvasGraphObservation,
  next: CanvasGraphObservation,
): boolean {
  if (
    previous.title !== next.title ||
    previous.settings !== next.settings ||
    previous.nodes.length !== next.nodes.length ||
    previous.edges.length !== next.edges.length
  ) {
    return false;
  }
  for (let index = 0; index < next.nodes.length; index += 1) {
    const left = previous.nodes[index]!;
    const right = next.nodes[index]!;
    if (
      left.id !== right.id ||
      left.type !== right.type ||
      left.parentId !== right.parentId ||
      left.position.x !== right.position.x ||
      left.position.y !== right.position.y ||
      left.width !== right.width ||
      left.height !== right.height ||
      left.data !== right.data
    ) {
      return false;
    }
  }
  for (let index = 0; index < next.edges.length; index += 1) {
    const left = previous.edges[index]!;
    const right = next.edges[index]!;
    if (
      left.id !== right.id ||
      left.source !== right.source ||
      left.target !== right.target ||
      left.sourceHandle !== right.sourceHandle ||
      left.targetHandle !== right.targetHandle ||
      left.data?.role !== right.data?.role ||
      left.data?.order !== right.data?.order
    ) {
      return false;
    }
  }
  return true;
}
