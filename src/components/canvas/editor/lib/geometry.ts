import type { Connection, Edge } from "@xyflow/react";

import { edgeRoleOptions } from "@/lib/canvas/canvas-edge-roles";
import type { CanvasNodeType } from "@/lib/tu-shared-browser";

/** Would adding `source → target` close a cycle? */
export function hasCycle(
  source: string,
  target: string,
  edges: Edge[],
): boolean {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.source) ?? [];
    list.push(edge.target);
    adjacency.set(edge.source, list);
  }
  const stack = [target];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === source) {
      return true;
    }
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    stack.push(...(adjacency.get(id) ?? []));
  }
  return false;
}

/** Type rules for a new connection, plus cycle prevention. */
export function isCanvasConnectionValid(
  connection: Connection | Edge,
  nodes: Array<{ id: string; type?: string | null }>,
  edges: Edge[],
): boolean {
  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);
  if (!source?.type || !target?.type) {
    return false;
  }
  const sourceType = source.type as CanvasNodeType;
  const targetType = target.type as CanvasNodeType;
  const handle = connection.targetHandle ?? "";
  if (
    (targetType === "image" ||
      targetType === "video" ||
      targetType === "audio") &&
    handle === "in"
  ) {
    if (edgeRoleOptions(sourceType, targetType).length === 0) {
      return false;
    }
    return !hasCycle(source.id, target.id, edges);
  }
  const acceptedType =
    handle === "prompt" || handle === "context" || handle === "text"
      ? "text"
      : handle === "reference_video"
        ? "video"
        : handle === "reference_audio"
          ? "audio"
          : "image";
  if (sourceType !== acceptedType) {
    return false;
  }
  return !hasCycle(source.id, target.id, edges);
}
