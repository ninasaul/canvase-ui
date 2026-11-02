export {
  CANVAS_GRAPH_LIMITS,
  CANVAS_GRAPH_SCHEMA_VERSION,
  assertCanvasGraphSize,
  canvasEdgeRoles,
  canvasNodeTypes,
  createEmptyCanvasGraph,
  parseCanvasGraph,
  validateCanvasGraph,
  type CanvasEdgeRole,
  type CanvasGraph,
  type CanvasGraphEdge,
  type CanvasGraphNode,
  type CanvasNodeData,
  type CanvasNodeType,
  type CanvasSettings,
} from "@/lib/canvas/canvas-graph";

import {
  parseCanvasGraph,
  type CanvasGraph,
} from "@/lib/canvas/canvas-graph";

export function isCanvasGraph(value: unknown): value is CanvasGraph {
  try {
    parseCanvasGraph(value);
    return true;
  } catch {
    return false;
  }
}
