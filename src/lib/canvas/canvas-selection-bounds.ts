import type { Connection, Edge } from "@xyflow/react";

import { edgeRoleOptions } from "./canvas-edge-roles";
import type { CanvasNodeType } from "./canvas-graph";
import { getNodeIndex } from "./canvas-node-index";
import { canvasNodeAbsolutePosition } from "./canvas-node-position";
import type { CanvasFlowNode } from "./canvas-store";

/**
 * Selection chrome for multi-selecting nodes (ported from the reference
 * canvas): a highlighted bounding box with one connection point, so a whole
 * selection can be wired to another node in a single drag.
 */
export const SELECTION_BOUNDS_NODE_ID = "__selection_bounds__";
export const SELECTION_BOUNDS_NODE_TYPE = "selectionBounds";
export const SELECTION_BOUNDS_PADDING = 16;
export const SELECTION_BOUNDS_SOURCE_HANDLE = "out";

const DEFAULT_NODE_WIDTH = 240;
const DEFAULT_NODE_HEIGHT = 200;
const DEFAULT_GROUP_WIDTH = 360;
const DEFAULT_GROUP_HEIGHT = 280;

export type SelectionBoundsRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  count: number;
  sourceIds: string[];
};

function nodeSize(node: CanvasFlowNode): { width: number; height: number } {
  if (node.type === "group") {
    return {
      width: node.width ?? node.measured?.width ?? DEFAULT_GROUP_WIDTH,
      height: node.height ?? node.measured?.height ?? DEFAULT_GROUP_HEIGHT,
    };
  }
  return {
    width: node.width ?? node.measured?.width ?? DEFAULT_NODE_WIDTH,
    height: node.height ?? node.measured?.height ?? DEFAULT_NODE_HEIGHT,
  };
}

/** Leaf nodes (plus the children of selected groups) inside the selection. */
export function collectSelectionBoundMembers(
  nodes: readonly CanvasFlowNode[],
): CanvasFlowNode[] {
  const selected = nodes.filter(
    (node) => node.selected && node.id !== SELECTION_BOUNDS_NODE_ID,
  );
  if (selected.length === 0) {
    return [];
  }
  const members: CanvasFlowNode[] = [];
  const seen = new Set<string>();
  for (const node of selected) {
    if (node.type === "group") {
      if (!seen.has(node.id)) {
        seen.add(node.id);
        members.push(node);
      }
      for (const child of nodes) {
        if (child.parentId === node.id && !seen.has(child.id)) {
          seen.add(child.id);
          members.push(child);
        }
      }
      continue;
    }
    if (!seen.has(node.id)) {
      seen.add(node.id);
      members.push(node);
    }
  }
  return members;
}

export function collectSelectionSourceIds(
  nodes: readonly CanvasFlowNode[],
): string[] {
  return collectSelectionBoundMembers(nodes)
    .filter((node) => node.type !== "group")
    .map((node) => node.id);
}

export function computeSelectionBounds(
  nodes: readonly CanvasFlowNode[],
): SelectionBoundsRect | null {
  const members = collectSelectionBoundMembers(nodes);
  const sourceIds = members
    .filter((node) => node.type !== "group")
    .map((node) => node.id);
  if (sourceIds.length < 2) {
    return null;
  }
  const byId = getNodeIndex(nodes as CanvasFlowNode[]);
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const node of members) {
    const origin = canvasNodeAbsolutePosition(node, byId);
    const size = nodeSize(node);
    minX = Math.min(minX, origin.x);
    minY = Math.min(minY, origin.y);
    maxX = Math.max(maxX, origin.x + size.width);
    maxY = Math.max(maxY, origin.y + size.height);
  }
  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return null;
  }
  return {
    x: minX - SELECTION_BOUNDS_PADDING,
    y: minY - SELECTION_BOUNDS_PADDING,
    width: Math.max(1, maxX - minX + SELECTION_BOUNDS_PADDING * 2),
    height: Math.max(1, maxY - minY + SELECTION_BOUNDS_PADDING * 2),
    count: sourceIds.length,
    sourceIds,
  };
}

export function isSelectionBoundsNodeId(
  id: string | null | undefined,
): boolean {
  return id === SELECTION_BOUNDS_NODE_ID;
}

function hasCycle(
  source: string,
  target: string,
  edges: readonly Edge[],
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

function canConnect(input: {
  sourceType: CanvasNodeType;
  targetType: CanvasNodeType;
  targetHandle: string;
  sourceId: string;
  targetId: string;
  edges: readonly Edge[];
}): boolean {
  const { sourceType, targetType, targetHandle, sourceId, targetId, edges } =
    input;
  if (sourceId === targetId) {
    return false;
  }
  if (
    (targetType === "image" ||
      targetType === "video" ||
      targetType === "audio") &&
    targetHandle === "in"
  ) {
    if (edgeRoleOptions(sourceType, targetType).length === 0) {
      return false;
    }
    return !hasCycle(sourceId, targetId, edges);
  }
  const acceptedType =
    targetHandle === "prompt" ||
    targetHandle === "context" ||
    targetHandle === "text"
      ? "text"
      : targetHandle === "reference_video"
        ? "video"
        : targetHandle === "reference_audio"
          ? "audio"
          : "image";
  if (sourceType !== acceptedType) {
    return false;
  }
  return !hasCycle(sourceId, targetId, edges);
}

function connectionAlreadyExists(
  edges: readonly Edge[],
  sourceId: string,
  targetId: string,
  targetHandle: string | null | undefined,
): boolean {
  return edges.some(
    (edge) =>
      edge.source === sourceId &&
      edge.target === targetId &&
      (edge.targetHandle ?? "") === (targetHandle ?? ""),
  );
}

/** Expand a connection drawn from the selection box into one per selected node. */
export function expandSelectionBoundsConnection(input: {
  connection: Connection;
  nodes: readonly CanvasFlowNode[];
  edges: readonly Edge[];
  sourceIds?: readonly string[];
}): Connection[] {
  const { connection, nodes, edges } = input;
  const sourceIds =
    input.sourceIds ?? collectSelectionSourceIds(nodes as CanvasFlowNode[]);
  const target = nodes.find((node) => node.id === connection.target);
  if (!target || target.type === "group") {
    return [];
  }
  const targetHandle = connection.targetHandle ?? "";
  const byId = getNodeIndex(nodes as CanvasFlowNode[]);
  const expanded: Connection[] = [];
  for (const sourceId of sourceIds) {
    if (sourceId === connection.target) {
      continue;
    }
    const source = byId.get(sourceId);
    if (!source || source.type === "group") {
      continue;
    }
    if (
      connectionAlreadyExists(edges, sourceId, connection.target, targetHandle)
    ) {
      continue;
    }
    if (
      !canConnect({
        sourceType: source.type,
        targetType: target.type,
        targetHandle,
        sourceId,
        targetId: connection.target,
        edges,
      })
    ) {
      continue;
    }
    expanded.push({
      ...connection,
      source: sourceId,
      sourceHandle: connection.sourceHandle ?? SELECTION_BOUNDS_SOURCE_HANDLE,
    });
  }
  return expanded;
}

/** Is a connection that starts at the selection box worth offering? */
export function selectionBoundsAllowsConnection(input: {
  connection: Connection | Edge;
  nodes: readonly CanvasFlowNode[];
  edges: readonly Edge[];
}): boolean {
  const { connection, nodes, edges } = input;
  if (!isSelectionBoundsNodeId(connection.source)) {
    return false;
  }
  return (
    expandSelectionBoundsConnection({
      connection: {
        source: connection.source,
        target: connection.target ?? "",
        sourceHandle: connection.sourceHandle ?? null,
        targetHandle: connection.targetHandle ?? null,
      },
      nodes,
      edges,
    }).length > 0
  );
}
