import {
  canvasEdgeRoles,
  canvasNodeTypes,
  type CanvasEdgeRole,
  type CanvasGraph,
  type CanvasGraphEdge,
  type CanvasGraphNode,
  type CanvasNodeData,
  type CanvasNodeType,
  validateCanvasGraph,
} from "@/lib/canvas/canvas-graph";
import { defaultEdgeRole, edgeRoleOptions } from "@/lib/canvas/canvas-edge-roles";
import { canvasNodeSizeFromData } from "@/lib/canvas/canvas-node-size";
import { normalizeNodeDataForPersistence } from "@/lib/canvas/canvas-graph";

export class CanvasToolMutationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanvasToolMutationError";
  }
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function isCanvasNodeType(value: unknown): value is CanvasNodeType {
  return (
    typeof value === "string" &&
    (canvasNodeTypes as readonly string[]).includes(value)
  );
}

function isCanvasEdgeRole(value: unknown): value is CanvasEdgeRole {
  return (
    typeof value === "string" &&
    (canvasEdgeRoles as readonly string[]).includes(value)
  );
}

/** Tool responses mirror what actually gets stored (no in-flight markers). */
function persistedNode(node: CanvasGraphNode): CanvasGraphNode {
  return { ...node, data: normalizeNodeDataForPersistence(node.data) };
}

function assertValidGraph(graph: CanvasGraph): void {
  const errors = validateCanvasGraph(graph);
  if (errors.length > 0) {
    throw new CanvasToolMutationError(errors[0] ?? "Invalid canvas graph");
  }
}

const GROUP_PAD_X = 24;
const GROUP_PAD_TOP = 40;
const GROUP_PAD_BOTTOM = 24;
const DEFAULT_GROUP_LABEL = "分组";

export type CanvasNodeSummary = {
  id: string;
  type: CanvasNodeType;
  label: string;
  position: { x: number; y: number };
  /** Present when the node lives inside a group (positions are group-relative). */
  parentId?: string;
  /** Groups only: ids of their direct children. */
  childIds?: string[];
  width?: number;
  height?: number;
  status?: string;
  model?: string;
  vendor?: string;
  /** Generation params currently set on the node. */
  params?: Record<string, unknown>;
  assetId?: string;
  url?: string;
  thumbnailUrl?: string;
};

function toNodeSummary(
  node: CanvasGraphNode,
  allNodes: CanvasGraphNode[],
): CanvasNodeSummary {
  const size = nodeSize(node);
  return {
    id: node.id,
    type: node.type,
    label: node.data.label?.trim() || node.type,
    position: node.position,
    ...(node.parentId ? { parentId: node.parentId } : {}),
    ...(node.type === "group"
      ? {
          childIds: allNodes
            .filter((item) => item.parentId === node.id)
            .map((item) => item.id),
        }
      : {}),
    width: size.width,
    height: size.height,
    ...(node.data.status ? { status: node.data.status } : {}),
    ...(node.data.model ? { model: node.data.model } : {}),
    ...(node.data.vendor ? { vendor: node.data.vendor } : {}),
    ...(node.data.params &&
    typeof node.data.params === "object" &&
    Object.keys(node.data.params).length > 0
      ? { params: node.data.params as Record<string, unknown> }
      : {}),
    ...(node.data.assetId ? { assetId: node.data.assetId } : {}),
    ...(node.data.url ? { url: node.data.url } : {}),
    ...(node.data.thumbnailUrl ? { thumbnailUrl: node.data.thumbnailUrl } : {}),
  };
}

export function summarizeCanvasGraph(
  title: string,
  version: number,
  graph: CanvasGraph,
) {
  return {
    title,
    version,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    selection: graph.selection ?? [],
    viewport: graph.viewport,
    nodes: graph.nodes.map((node) => toNodeSummary(node, graph.nodes)),
    groups: graph.nodes
      .filter((node) => node.type === "group")
      .map((node) => ({
        id: node.id,
        label: node.data.label?.trim() || DEFAULT_GROUP_LABEL,
        position: node.position,
        width: nodeSize(node).width,
        height: nodeSize(node).height,
        childIds: graph.nodes
          .filter((item) => item.parentId === node.id)
          .map((item) => item.id),
      })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      role: edge.data?.role ?? "prompt",
    })),
  };
}

export function getCanvasNodeDetail(graph: CanvasGraph, nodeId: string) {
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node) {
    throw new CanvasToolMutationError(`Node not found: ${nodeId}`);
  }
  const incoming = graph.edges.filter((edge) => edge.target === nodeId);
  const outgoing = graph.edges.filter((edge) => edge.source === nodeId);
  return {
    node,
    incoming,
    outgoing,
  };
}

export function searchCanvasNodes(
  graph: CanvasGraph,
  query: {
    type?: CanvasNodeType;
    labelIncludes?: string;
  },
): CanvasNodeSummary[] {
  const needle = query.labelIncludes?.trim().toLowerCase() ?? "";
  return graph.nodes
    .filter((node) => {
      if (query.type && node.type !== query.type) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const label = (node.data.label ?? "").toLowerCase();
      const prompt = (node.data.prompt ?? "").toLowerCase();
      const text = (node.data.text ?? "").toLowerCase();
      return (
        label.includes(needle) ||
        prompt.includes(needle) ||
        text.includes(needle) ||
        node.id.toLowerCase().includes(needle)
      );
    })
    .map((node) => toNodeSummary(node, graph.nodes));
}

const DEFAULT_NODE_SIZE: Record<CanvasNodeType, { width: number; height: number }> =
  {
    text: { width: 220, height: 120 },
    image: { width: 240, height: 242 },
    video: { width: 280, height: 160 },
    audio: { width: 220, height: 120 },
    group: { width: 360, height: 280 },
  };

function nodeSize(node: CanvasGraphNode): { width: number; height: number } {
  const fallback = DEFAULT_NODE_SIZE[node.type];
  return {
    width: node.width ?? fallback.width,
    height: node.height ?? fallback.height,
  };
}

/** Absolute position of a node, accounting for group parenting. */
function absolutePosition(
  graph: CanvasGraph,
  node: CanvasGraphNode,
): { x: number; y: number } {
  if (!node.parentId) {
    return { x: node.position.x, y: node.position.y };
  }
  const parent = graph.nodes.find((item) => item.id === node.parentId);
  if (!parent) {
    return { x: node.position.x, y: node.position.y };
  }
  return {
    x: parent.position.x + node.position.x,
    y: parent.position.y + node.position.y,
  };
}

function assertGroup(graph: CanvasGraph, groupId: string): CanvasGraphNode {
  const group = graph.nodes.find((node) => node.id === groupId);
  if (!group || group.type !== "group") {
    throw new CanvasToolMutationError(`Group not found: ${groupId}`);
  }
  return group;
}

/** Reject cycles: a group can never become a child of its own descendant. */
function assertNoParentCycle(
  graph: CanvasGraph,
  nodeId: string,
  parentId: string,
): void {
  if (nodeId === parentId) {
    throw new CanvasToolMutationError("A node cannot parent itself");
  }
  let cursor: CanvasGraphNode | undefined = graph.nodes.find(
    (node) => node.id === parentId,
  );
  const seen = new Set<string>();
  while (cursor?.parentId) {
    if (cursor.parentId === nodeId) {
      throw new CanvasToolMutationError("That would create a grouping cycle");
    }
    if (seen.has(cursor.parentId)) {
      break;
    }
    seen.add(cursor.parentId);
    cursor = graph.nodes.find((node) => node.id === cursor!.parentId);
  }
}

/** Clamp a node into a group's padded box and grow the group if needed. */
function placeInsideGroup(
  group: CanvasGraphNode,
  node: CanvasGraphNode,
  absolute: { x: number; y: number },
): {
  position: { x: number; y: number };
  groupWidth: number;
  groupHeight: number;
} {
  const size = nodeSize(node);
  const groupSize = nodeSize(group);
  const relativeX = absolute.x - group.position.x;
  const relativeY = absolute.y - group.position.y;
  const minX = GROUP_PAD_X;
  const minY = GROUP_PAD_TOP;
  const maxX = Math.max(minX, groupSize.width - GROUP_PAD_X - size.width);
  const maxY = Math.max(minY, groupSize.height - GROUP_PAD_BOTTOM - size.height);
  const x = Math.min(Math.max(relativeX, minX), maxX);
  const y = Math.min(Math.max(relativeY, minY), maxY);
  return {
    position: { x, y },
    groupWidth: Math.max(groupSize.width, x + size.width + GROUP_PAD_X),
    groupHeight: Math.max(groupSize.height, y + size.height + GROUP_PAD_BOTTOM),
  };
}

function withParentsFirst(nodes: CanvasGraphNode[]): CanvasGraphNode[] {
  return [
    ...nodes.filter((node) => node.type === "group"),
    ...nodes.filter((node) => node.type !== "group"),
  ];
}

export function addCanvasNode(
  graph: CanvasGraph,
  input: {
    type: CanvasNodeType;
    position?: { x: number; y: number };
    data?: Partial<CanvasNodeData>;
    width?: number;
    height?: number;
    id?: string;
    /** Place the new node inside this group (position becomes group-relative). */
    parentId?: string | null;
  },
): { graph: CanvasGraph; node: CanvasGraphNode } {
  if (!isCanvasNodeType(input.type)) {
    throw new CanvasToolMutationError("Invalid node type");
  }
  const id = input.id?.trim() || newId(input.type);
  if (graph.nodes.some((node) => node.id === id)) {
    throw new CanvasToolMutationError(`Node id already exists: ${id}`);
  }
  const size = DEFAULT_NODE_SIZE[input.type];
  const params = input.data?.params;
  const derivedSize =
    (input.type === "image" || input.type === "video") &&
    input.width === undefined &&
    input.height === undefined &&
    params &&
    typeof params === "object"
      ? canvasNodeSizeFromData(input.type, { params } as CanvasNodeData)
      : null;
  const node: CanvasGraphNode = {
    id,
    type: input.type,
    position: {
      x: input.position?.x ?? 80,
      y: input.position?.y ?? 80,
    },
    width: input.width ?? derivedSize?.width ?? size.width,
    height: input.height ?? derivedSize?.height ?? size.height,
    data: {
      label: "",
      ...(input.type === "text" ? { text: "" } : {}),
      ...(input.type === "image" || input.type === "video"
        ? { prompt: "", status: "idle" }
        : {}),
      ...(input.type === "audio" ? { status: "idle" } : {}),
      ...(input.data ?? {}),
    },
  };
  const parentId = input.parentId?.trim();
  if (parentId) {
    const group = assertGroup(graph, parentId);
    const placed = placeInsideGroup(group, node, node.position);
    node.parentId = parentId;
    node.position = placed.position;
    const resizedGroup: CanvasGraphNode = {
      ...group,
      width: placed.groupWidth,
      height: placed.groupHeight,
    };
    const next: CanvasGraph = {
      ...graph,
      nodes: withParentsFirst([
        ...graph.nodes.map((item) =>
          item.id === group.id ? resizedGroup : item,
        ),
        node,
      ]),
    };
    assertValidGraph(next);
    return { graph: next, node: persistedNode(node) };
  }

  const next: CanvasGraph = {
    ...graph,
    nodes: [...graph.nodes, node],
  };
  assertValidGraph(next);
  return { graph: next, node: persistedNode(node) };
}

export function updateCanvasNode(
  graph: CanvasGraph,
  input: {
    nodeId: string;
    data?: Partial<CanvasNodeData>;
    position?: { x: number; y: number };
    width?: number;
    height?: number;
    /** Move into a group (string) or out of any group (null). */
    parentId?: string | null;
  },
): { graph: CanvasGraph; node: CanvasGraphNode } {
  const index = graph.nodes.findIndex((node) => node.id === input.nodeId);
  if (index < 0) {
    throw new CanvasToolMutationError(`Node not found: ${input.nodeId}`);
  }
  const current = graph.nodes[index]!;

  let position = input.position
    ? { x: input.position.x, y: input.position.y }
    : current.position;
  let parentId = current.parentId;
  let resizedGroup: CanvasGraphNode | null = null;

  if (input.parentId !== undefined) {
    const target = input.parentId?.trim() || null;
    if (!target) {
      if (current.parentId) {
        position = absolutePosition(graph, current);
        parentId = undefined;
      }
    } else {
      const group = assertGroup(graph, target);
      assertNoParentCycle(graph, current.id, target);
      const absolute = input.position ?? absolutePosition(graph, current);
      const placed = placeInsideGroup(group, current, absolute);
      position = placed.position;
      parentId = target;
      resizedGroup = {
        ...group,
        width: placed.groupWidth,
        height: placed.groupHeight,
      };
    }
  }

  // Generation params merge key-by-key; everything else replaces.
  const patch = (input.data ?? {}) as Partial<CanvasNodeData>;
  const currentParams =
    current.data.params && typeof current.data.params === "object"
      ? (current.data.params as Record<string, unknown>)
      : {};
  const patchParams =
    patch.params && typeof patch.params === "object" && !Array.isArray(patch.params)
      ? (patch.params as Record<string, unknown>)
      : null;
  const data: CanvasNodeData = {
    ...current.data,
    ...patch,
    ...(patchParams ? { params: { ...currentParams, ...patchParams } } : {}),
  };
  if (patchParams === null && "params" in patch && patch.params === null) {
    delete data.params;
  }

  const node: CanvasGraphNode = {
    ...current,
    position,
    ...(input.width !== undefined ? { width: input.width } : {}),
    ...(input.height !== undefined ? { height: input.height } : {}),
    data,
  };

  // Changing size/aspect-ratio params must resize the node the same way the
  // editor's generation dock does, otherwise the canvas keeps the old shape.
  if (
    patchParams &&
    input.width === undefined &&
    input.height === undefined &&
    (node.type === "image" || node.type === "video")
  ) {
    const derived = canvasNodeSizeFromData(node.type, data);
    if (derived) {
      node.width = derived.width;
      node.height = derived.height;
    }
  }
  if (parentId) {
    node.parentId = parentId;
  } else {
    delete node.parentId;
  }

  const nodes = graph.nodes.map((item) => {
    if (item.id === node.id) {
      return node;
    }
    if (resizedGroup && item.id === resizedGroup.id) {
      return resizedGroup;
    }
    return item;
  });
  const next: CanvasGraph = { ...graph, nodes: withParentsFirst(nodes) };
  assertValidGraph(next);
  return { graph: next, node: persistedNode(node) };
}

/** Wrap the given nodes in a new group sized to their bounding box. */
export function groupCanvasNodes(
  graph: CanvasGraph,
  input: { nodeIds: string[]; label?: string; id?: string },
): { graph: CanvasGraph; group: CanvasGraphNode } {
  const unique = Array.from(new Set(input.nodeIds.map((id) => id.trim()).filter(Boolean)));
  if (unique.length === 0) {
    throw new CanvasToolMutationError("nodeIds is required");
  }
  const members: CanvasGraphNode[] = [];
  for (const id of unique) {
    const node = graph.nodes.find((item) => item.id === id);
    if (!node) {
      throw new CanvasToolMutationError(`Node not found: ${id}`);
    }
    if (node.type === "group") {
      throw new CanvasToolMutationError(`Cannot group a group: ${id}`);
    }
    if (node.parentId) {
      throw new CanvasToolMutationError(
        `Node already belongs to a group: ${id}`,
      );
    }
    members.push(node);
  }

  const boxes = members.map((node) => {
    const size = nodeSize(node);
    return {
      node,
      left: node.position.x,
      top: node.position.y,
      right: node.position.x + size.width,
      bottom: node.position.y + size.height,
    };
  });
  const minX = Math.min(...boxes.map((box) => box.left));
  const minY = Math.min(...boxes.map((box) => box.top));
  const maxX = Math.max(...boxes.map((box) => box.right));
  const maxY = Math.max(...boxes.map((box) => box.bottom));

  const groupId = input.id?.trim() || newId("group");
  if (graph.nodes.some((node) => node.id === groupId)) {
    throw new CanvasToolMutationError(`Node id already exists: ${groupId}`);
  }
  const group: CanvasGraphNode = {
    id: groupId,
    type: "group",
    position: { x: minX - GROUP_PAD_X, y: minY - GROUP_PAD_TOP },
    width: maxX - minX + GROUP_PAD_X * 2,
    height: maxY - minY + GROUP_PAD_TOP + GROUP_PAD_BOTTOM,
    data: { label: input.label?.trim() || DEFAULT_GROUP_LABEL },
  };

  const memberIds = new Set(unique);
  const nodes = graph.nodes.map((node) => {
    if (!memberIds.has(node.id)) {
      return node;
    }
    return {
      ...node,
      parentId: groupId,
      position: {
        x: node.position.x - group.position.x,
        y: node.position.y - group.position.y,
      },
    };
  });

  const next: CanvasGraph = {
    ...graph,
    nodes: withParentsFirst([...nodes, group]),
  };
  assertValidGraph(next);
  return { graph: next, group };
}

/** Dissolve a group: children keep their on-screen position, group is removed. */
export function ungroupCanvasNode(
  graph: CanvasGraph,
  groupId: string,
): { graph: CanvasGraph; releasedNodeIds: string[] } {
  const group = assertGroup(graph, groupId);
  const released: string[] = [];
  const nodes: CanvasGraphNode[] = [];
  for (const node of graph.nodes) {
    if (node.id === group.id) {
      continue;
    }
    if (node.parentId !== group.id) {
      nodes.push(node);
      continue;
    }
    released.push(node.id);
    const next: CanvasGraphNode = {
      ...node,
      position: {
        x: group.position.x + node.position.x,
        y: group.position.y + node.position.y,
      },
    };
    delete next.parentId;
    nodes.push(next);
  }
  if (released.length === 0) {
    throw new CanvasToolMutationError(`Group has no children: ${groupId}`);
  }
  const next: CanvasGraph = { ...graph, nodes: withParentsFirst(nodes) };
  assertValidGraph(next);
  return { graph: next, releasedNodeIds: released };
}

export function deleteCanvasNodes(
  graph: CanvasGraph,
  nodeIds: string[],
): { graph: CanvasGraph; deletedNodeIds: string[]; deletedEdgeIds: string[] } {
  const remove = new Set(nodeIds);
  if (remove.size === 0) {
    throw new CanvasToolMutationError("nodeIds is required");
  }
  const missing = [...remove].filter(
    (id) => !graph.nodes.some((node) => node.id === id),
  );
  if (missing.length > 0) {
    throw new CanvasToolMutationError(`Node not found: ${missing[0]}`);
  }
  const deletedEdges = graph.edges.filter(
    (edge) => remove.has(edge.source) || remove.has(edge.target),
  );
  const next: CanvasGraph = {
    ...graph,
    nodes: graph.nodes.filter((node) => !remove.has(node.id)),
    edges: graph.edges.filter(
      (edge) => !remove.has(edge.source) && !remove.has(edge.target),
    ),
    selection: (graph.selection ?? []).filter((id) => !remove.has(id)),
  };
  assertValidGraph(next);
  return {
    graph: next,
    deletedNodeIds: [...remove],
    deletedEdgeIds: deletedEdges.map((edge) => edge.id),
  };
}

export function connectCanvasNodes(
  graph: CanvasGraph,
  input: {
    source: string;
    target: string;
    role?: CanvasEdgeRole;
    id?: string;
  },
): { graph: CanvasGraph; edge: CanvasGraphEdge } {
  const source = graph.nodes.find((node) => node.id === input.source);
  const target = graph.nodes.find((node) => node.id === input.target);
  if (!source) {
    throw new CanvasToolMutationError(`Source node not found: ${input.source}`);
  }
  if (!target) {
    throw new CanvasToolMutationError(`Target node not found: ${input.target}`);
  }
  if (source.id === target.id) {
    throw new CanvasToolMutationError("Cannot connect a node to itself");
  }
  const allowed = edgeRoleOptions(source.type, target.type);
  if (allowed.length === 0) {
    throw new CanvasToolMutationError(
      `No valid edge role between ${source.type} and ${target.type}`,
    );
  }
  const role =
    input.role && isCanvasEdgeRole(input.role)
      ? input.role
      : defaultEdgeRole(source.type, target.type) ?? allowed[0]!;
  if (!allowed.includes(role)) {
    throw new CanvasToolMutationError(
      `Invalid role "${role}" for ${source.type} → ${target.type}`,
    );
  }
  const id = input.id?.trim() || newId("edge");
  if (graph.edges.some((edge) => edge.id === id)) {
    throw new CanvasToolMutationError(`Edge id already exists: ${id}`);
  }
  const duplicate = graph.edges.find(
    (edge) =>
      edge.source === source.id &&
      edge.target === target.id &&
      (edge.data?.role ?? "prompt") === role,
  );
  if (duplicate) {
    throw new CanvasToolMutationError("Equivalent edge already exists");
  }
  const edge: CanvasGraphEdge = {
    id,
    source: source.id,
    target: target.id,
    targetHandle: role,
    data: { role },
  };
  const next: CanvasGraph = {
    ...graph,
    edges: [...graph.edges, edge],
  };
  assertValidGraph(next);
  return { graph: next, edge };
}

export function disconnectCanvasNodes(
  graph: CanvasGraph,
  input: { edgeId?: string; source?: string; target?: string; role?: CanvasEdgeRole },
): { graph: CanvasGraph; removedEdgeIds: string[] } {
  let removed: CanvasGraphEdge[] = [];
  if (input.edgeId) {
    const edge = graph.edges.find((item) => item.id === input.edgeId);
    if (!edge) {
      throw new CanvasToolMutationError(`Edge not found: ${input.edgeId}`);
    }
    removed = [edge];
  } else if (input.source && input.target) {
    removed = graph.edges.filter((edge) => {
      if (edge.source !== input.source || edge.target !== input.target) {
        return false;
      }
      if (input.role) {
        return (edge.data?.role ?? "prompt") === input.role;
      }
      return true;
    });
    if (removed.length === 0) {
      throw new CanvasToolMutationError("No matching edge to disconnect");
    }
  } else {
    throw new CanvasToolMutationError(
      "Provide edgeId or source+target to disconnect",
    );
  }
  const removeIds = new Set(removed.map((edge) => edge.id));
  const next: CanvasGraph = {
    ...graph,
    edges: graph.edges.filter((edge) => !removeIds.has(edge.id)),
  };
  assertValidGraph(next);
  return {
    graph: next,
    removedEdgeIds: [...removeIds],
  };
}

export function setCanvasSelection(
  graph: CanvasGraph,
  nodeIds: string[],
): { graph: CanvasGraph; selection: string[] } {
  const unique = [...new Set(nodeIds.map((id) => id.trim()).filter(Boolean))];
  for (const id of unique) {
    if (!graph.nodes.some((node) => node.id === id)) {
      throw new CanvasToolMutationError(`Node not found: ${id}`);
    }
  }
  const next: CanvasGraph = {
    ...graph,
    selection: unique,
  };
  assertValidGraph(next);
  return { graph: next, selection: unique };
}
