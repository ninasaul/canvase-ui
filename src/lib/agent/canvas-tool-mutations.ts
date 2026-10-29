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

function assertValidGraph(graph: CanvasGraph): void {
  const errors = validateCanvasGraph(graph);
  if (errors.length > 0) {
    throw new CanvasToolMutationError(errors[0] ?? "Invalid canvas graph");
  }
}

export type CanvasNodeSummary = {
  id: string;
  type: CanvasNodeType;
  label: string;
  position: { x: number; y: number };
  status?: string;
  model?: string;
  assetId?: string;
  url?: string;
  thumbnailUrl?: string;
};

function toNodeSummary(node: CanvasGraphNode): CanvasNodeSummary {
  return {
    id: node.id,
    type: node.type,
    label: node.data.label?.trim() || node.type,
    position: node.position,
    ...(node.data.status ? { status: node.data.status } : {}),
    ...(node.data.model ? { model: node.data.model } : {}),
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
    nodes: graph.nodes.map((node) => toNodeSummary(node)),
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
    .map((node) => toNodeSummary(node));
}

const DEFAULT_NODE_SIZE: Record<CanvasNodeType, { width: number; height: number }> =
  {
    text: { width: 220, height: 120 },
    image: { width: 240, height: 242 },
    video: { width: 280, height: 160 },
    audio: { width: 220, height: 120 },
    group: { width: 360, height: 280 },
  };

export function addCanvasNode(
  graph: CanvasGraph,
  input: {
    type: CanvasNodeType;
    position?: { x: number; y: number };
    data?: Partial<CanvasNodeData>;
    width?: number;
    height?: number;
    id?: string;
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
  const node: CanvasGraphNode = {
    id,
    type: input.type,
    position: {
      x: input.position?.x ?? 80,
      y: input.position?.y ?? 80,
    },
    width: input.width ?? size.width,
    height: input.height ?? size.height,
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
  const next: CanvasGraph = {
    ...graph,
    nodes: [...graph.nodes, node],
  };
  assertValidGraph(next);
  return { graph: next, node };
}

export function updateCanvasNode(
  graph: CanvasGraph,
  input: {
    nodeId: string;
    data?: Partial<CanvasNodeData>;
    position?: { x: number; y: number };
    width?: number;
    height?: number;
  },
): { graph: CanvasGraph; node: CanvasGraphNode } {
  const index = graph.nodes.findIndex((node) => node.id === input.nodeId);
  if (index < 0) {
    throw new CanvasToolMutationError(`Node not found: ${input.nodeId}`);
  }
  const current = graph.nodes[index]!;
  const node: CanvasGraphNode = {
    ...current,
    ...(input.position
      ? {
          position: {
            x: input.position.x,
            y: input.position.y,
          },
        }
      : {}),
    ...(input.width !== undefined ? { width: input.width } : {}),
    ...(input.height !== undefined ? { height: input.height } : {}),
    data: {
      ...current.data,
      ...(input.data ?? {}),
    },
  };
  const nodes = [...graph.nodes];
  nodes[index] = node;
  const next: CanvasGraph = { ...graph, nodes };
  assertValidGraph(next);
  return { graph: next, node };
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
