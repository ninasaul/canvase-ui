/** Shared canvas graph contract used by the admin editor and the API validator. */

export const canvasNodeTypes = ["text", "image", "video", "audio", "group"] as const;
export type CanvasNodeType = (typeof canvasNodeTypes)[number];

export const canvasEdgeRoles = [
  "context",
  "prompt",
  "reference_image",
  "first_frame",
  "last_frame",
  "reference_video",
  "reference_audio",
] as const;
export type CanvasEdgeRole = (typeof canvasEdgeRoles)[number];

export const canvasNodeRunStatuses = [
  "idle",
  "queued",
  "running",
  "succeeded",
  "failed",
  "skipped",
  "cancelled",
  "interrupted",
] as const;
export type CanvasNodeRunStatus = (typeof canvasNodeRunStatuses)[number];

export type CanvasMediaReference = {
  mediaType: "image" | "video" | "audio";
  url: string;
  name?: string;
  assetId?: string;
};

export type CanvasNodeData = {
  label?: string;
  /** Text node content / generated text. */
  text?: string;
  /** Text nodes: static prompt source or executable chat generation. */
  systemPrompt?: string;
  /** Generation prompt for image/video nodes. */
  prompt?: string;
  model?: string;
  vendor?: string;
  source?: "upload" | "generation" | "library";
  assetId?: string;
  assetIds?: string[];
  url?: string;
  urls?: string[];
  /** Smaller preview URL when the asset pipeline has generated one. */
  thumbnailUrl?: string;
  /** Manual references configured in the generation dock. */
  references?: CanvasMediaReference[];
  params?: Record<string, unknown>;
  status?: CanvasNodeRunStatus;
  requestId?: string;
  taskId?: string;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
  [key: string]: unknown;
};

export type CanvasGraphNode = {
  id: string;
  type: CanvasNodeType;
  position: { x: number; y: number };
  data: CanvasNodeData;
  width?: number;
  height?: number;
  /** Group parents keep child positions relative to the group. */
  parentId?: string;
};

export type CanvasGraphEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: {
    role: CanvasEdgeRole;
    order?: number;
  };
};

export type CanvasGenerationDefaults = {
  model?: string;
  vendor?: string;
  params?: Record<string, unknown>;
  systemPrompt?: string;
};

export type CanvasSettings = {
  image?: CanvasGenerationDefaults;
  video?: CanvasGenerationDefaults;
  text?: CanvasGenerationDefaults;
  audio?: CanvasGenerationDefaults;
};

export type CanvasGraph = {
  schemaVersion: 1;
  viewport: { x: number; y: number; zoom: number };
  nodes: CanvasGraphNode[];
  edges: CanvasGraphEdge[];
  settings?: CanvasSettings;
  /** Logical selection (agent tools / multiplayer); optional. */
  selection?: string[];
};

export const CANVAS_GRAPH_SCHEMA_VERSION = 1 as const;

/**
 * Session-only run markers. They live in the editor's memory (and the
 * run-status store) but must never reach the persisted graph: whoever loads
 * the canvas later has no way to finish them.
 */
export const TRANSIENT_NODE_DATA_KEYS = [
  "requestId",
  "taskId",
  "runId",
  "startedAt",
] as const;

const IN_FLIGHT_RUN_STATUSES = new Set(["running", "queued"]);

/**
 * Strip in-flight run markers before a node is saved or exported.
 *
 * An in-flight node is rewritten as `interrupted` so a reload shows an honest
 * "this was running" state the user can retry, instead of a zombie `running`
 * that nothing will ever complete. Terminal outcomes (succeeded / failed /
 * cancelled), `error`, `finishedAt` and result fields are kept.
 */
export function normalizeNodeDataForPersistence(
  data: CanvasNodeData,
): CanvasNodeData {
  const status = data.status;
  const inFlight =
    typeof status === "string" && IN_FLIGHT_RUN_STATUSES.has(status);
  const hasTransient = TRANSIENT_NODE_DATA_KEYS.some((key) => key in data);
  if (!inFlight && !hasTransient) {
    return data;
  }
  const next: CanvasNodeData = { ...data };
  for (const key of TRANSIENT_NODE_DATA_KEYS) {
    delete next[key];
  }
  if (inFlight) {
    next.status = "interrupted";
  }
  return next;
}

export const CANVAS_GRAPH_LIMITS = {
  maxNodes: 200,
  maxEdges: 400,
  maxBytes: 512 * 1024,
} as const;

/** Write-path guard: reject graphs above the byte budget before persisting. */
export function assertCanvasGraphSize(graph: unknown): void {
  let bytes = 0;
  try {
    bytes = Buffer.byteLength(JSON.stringify(graph ?? null), "utf8");
  } catch {
    throw new CanvasGraphValidationError(["画布数据无法序列化"]);
  }
  if (bytes > CANVAS_GRAPH_LIMITS.maxBytes) {
    throw new CanvasGraphValidationError([
      `画布数据不能超过 ${Math.floor(CANVAS_GRAPH_LIMITS.maxBytes / 1024)} KB`,
    ]);
  }
}

export class CanvasGraphValidationError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors[0] ?? "工作流数据无效");
    this.name = "CanvasGraphValidationError";
    this.errors = errors;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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

export function createEmptyCanvasGraph(): CanvasGraph {
  return {
    schemaVersion: CANVAS_GRAPH_SCHEMA_VERSION,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    edges: [],
  };
}

function readNode(value: unknown, index: number, errors: string[]): CanvasGraphNode | null {
  if (!isRecord(value)) {
    errors.push(`nodes[${index}] 必须是对象`);
    return null;
  }
  const id = typeof value.id === "string" ? value.id.trim() : "";
  if (!id) {
    errors.push(`nodes[${index}].id 不能为空`);
    return null;
  }
  if (!isCanvasNodeType(value.type)) {
    errors.push(`节点 ${id} 的类型必须是 ${canvasNodeTypes.join(" / ")}`);
    return null;
  }
  if (!isRecord(value.position)) {
    errors.push(`节点 ${id} 缺少 position`);
    return null;
  }
  const x = value.position.x;
  const y = value.position.y;
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
    errors.push(`节点 ${id} 的 position 必须是有限数字`);
    return null;
  }
  if (!isRecord(value.data)) {
    errors.push(`节点 ${id} 缺少 data`);
    return null;
  }
  return {
    id,
    type: value.type,
    position: { x, y },
    data: normalizeNodeDataForPersistence(value.data as CanvasNodeData),
    ...(isFiniteNumber(value.width) ? { width: value.width } : {}),
    ...(isFiniteNumber(value.height) ? { height: value.height } : {}),
    ...(typeof value.parentId === "string" && value.parentId.trim()
      ? { parentId: value.parentId.trim() }
      : {}),
  };
}

function readEdge(value: unknown, index: number, errors: string[]): CanvasGraphEdge | null {
  if (!isRecord(value)) {
    errors.push(`edges[${index}] 必须是对象`);
    return null;
  }
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const source = typeof value.source === "string" ? value.source.trim() : "";
  const target = typeof value.target === "string" ? value.target.trim() : "";
  if (!id) {
    errors.push(`edges[${index}].id 不能为空`);
    return null;
  }
  if (!source || !target) {
    errors.push(`边 ${id} 缺少 source/target`);
    return null;
  }
  if (source === target) {
    errors.push(`边 ${id} 不能连接节点自身`);
    return null;
  }
  let data: CanvasGraphEdge["data"];
  if (value.data !== undefined) {
    if (!isRecord(value.data) || !isCanvasEdgeRole(value.data.role)) {
      errors.push(`边 ${id} 的 role 无效`);
      return null;
    }
    data = {
      role: value.data.role,
      ...(isFiniteNumber(value.data.order) ? { order: value.data.order } : {}),
    };
  }
  return {
    id,
    source,
    target,
    ...(typeof value.sourceHandle === "string"
      ? { sourceHandle: value.sourceHandle }
      : {}),
    ...(typeof value.targetHandle === "string"
      ? { targetHandle: value.targetHandle }
      : {}),
    ...(data ? { data } : {}),
  };
}

function detectCycle(
  nodeIds: string[],
  edges: CanvasGraphEdge[],
): string[] | null {
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const id of nodeIds) {
    indegree.set(id, 0);
    adjacency.set(id, []);
  }
  for (const edge of edges) {
    if (!indegree.has(edge.source) || !indegree.has(edge.target)) {
      continue;
    }
    adjacency.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }
  const queue = nodeIds.filter((id) => (indegree.get(id) ?? 0) === 0);
  let visited = 0;
  while (queue.length > 0) {
    const id = queue.shift()!;
    visited += 1;
    for (const next of adjacency.get(id) ?? []) {
      const nextDegree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextDegree);
      if (nextDegree === 0) {
        queue.push(next);
      }
    }
  }
  if (visited === nodeIds.length) {
    return null;
  }
  return nodeIds.filter((id) => (indegree.get(id) ?? 0) > 0);
}

/** Returns a list of human-readable problems; empty means valid. */
export function validateCanvasGraph(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["工作流必须是对象"];
  }
  if (value.schemaVersion !== CANVAS_GRAPH_SCHEMA_VERSION) {
    return [`不支持的 schemaVersion：${String(value.schemaVersion)}`];
  }
  if (!isRecord(value.viewport)) {
    return ["缺少 viewport"];
  }
  if (
    !isFiniteNumber(value.viewport.x) ||
    !isFiniteNumber(value.viewport.y) ||
    !isFiniteNumber(value.viewport.zoom) ||
    (value.viewport.zoom as number) <= 0
  ) {
    return ["viewport 必须是有限数字，zoom 必须大于 0"];
  }
  if (!Array.isArray(value.nodes)) {
    return ["nodes 必须是数组"];
  }
  if (!Array.isArray(value.edges)) {
    return ["edges 必须是数组"];
  }
  if (value.nodes.length > CANVAS_GRAPH_LIMITS.maxNodes) {
    return [`节点不能超过 ${CANVAS_GRAPH_LIMITS.maxNodes} 个`];
  }
  if (value.edges.length > CANVAS_GRAPH_LIMITS.maxEdges) {
    return [`连线不能超过 ${CANVAS_GRAPH_LIMITS.maxEdges} 条`];
  }

  const errors: string[] = [];
  const nodeIds = new Set<string>();
  const nodes: CanvasGraphNode[] = [];
  for (let index = 0; index < value.nodes.length; index += 1) {
    const node = readNode(value.nodes[index], index, errors);
    if (!node) {
      continue;
    }
    if (nodeIds.has(node.id)) {
      errors.push(`节点 id 重复：${node.id}`);
      continue;
    }
    nodeIds.add(node.id);
    nodes.push(node);
  }

  for (const node of nodes) {
    if (!node.parentId) {
      continue;
    }
    if (node.parentId === node.id) {
      errors.push(`节点 ${node.id} 不能以自身为分组`);
      continue;
    }
    const parent = nodes.find((item) => item.id === node.parentId);
    if (!parent) {
      errors.push(`节点 ${node.id} 的分组不存在：${node.parentId}`);
    } else if (parent.type !== "group") {
      errors.push(`节点 ${node.id} 的 parentId 必须指向分组节点`);
    }
  }

  const edgeIds = new Set<string>();
  const edges: CanvasGraphEdge[] = [];
  for (let index = 0; index < value.edges.length; index += 1) {
    const edge = readEdge(value.edges[index], index, errors);
    if (!edge) {
      continue;
    }
    if (edgeIds.has(edge.id)) {
      errors.push(`边 id 重复：${edge.id}`);
      continue;
    }
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source)) {
      errors.push(`边 ${edge.id} 的 source 不存在：${edge.source}`);
      continue;
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`边 ${edge.id} 的 target 不存在：${edge.target}`);
      continue;
    }
    edges.push(edge);
  }

  if (errors.length === 0) {
    const cycle = detectCycle([...nodeIds], edges);
    if (cycle) {
      errors.push(`工作流存在环：${cycle.join(" → ")}`);
    }
  }
  return errors;
}

export function parseCanvasGraph(value: unknown): CanvasGraph {
  const errors = validateCanvasGraph(value);
  if (errors.length > 0) {
    throw new CanvasGraphValidationError(errors);
  }
  const graph = value as unknown as CanvasGraph;
  return {
    schemaVersion: CANVAS_GRAPH_SCHEMA_VERSION,
    viewport: {
      x: graph.viewport.x,
      y: graph.viewport.y,
      zoom: graph.viewport.zoom,
    },
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: { x: node.position.x, y: node.position.y },
      data: normalizeNodeDataForPersistence(node.data),
      ...(node.width !== undefined ? { width: node.width } : {}),
      ...(node.height !== undefined ? { height: node.height } : {}),
      ...(node.parentId !== undefined ? { parentId: node.parentId } : {}),
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(edge.sourceHandle !== undefined
        ? { sourceHandle: edge.sourceHandle }
        : {}),
      ...(edge.targetHandle !== undefined
        ? { targetHandle: edge.targetHandle }
        : {}),
      ...(edge.data ? { data: edge.data } : {}),
    })),
    ...(isRecord(graph.settings)
      ? { settings: graph.settings as CanvasSettings }
      : {}),
    ...(Array.isArray(graph.selection)
      ? {
          selection: graph.selection.filter(
            (id): id is string => typeof id === "string" && id.trim().length > 0,
          ),
        }
      : {}),
  };
}

/** Topological order for execution. Throws when the graph is invalid. */
export function sortCanvasNodes(graph: CanvasGraph): CanvasGraphNode[] {
  const errors = validateCanvasGraph(graph);
  if (errors.length > 0) {
    throw new CanvasGraphValidationError(errors);
  }
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) {
    indegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }
  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }
  const queue = graph.nodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .map((node) => node.id);
  const order: CanvasGraphNode[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = byId.get(id);
    if (node) {
      order.push(node);
    }
    for (const next of adjacency.get(id) ?? []) {
      const nextDegree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextDegree);
      if (nextDegree === 0) {
        queue.push(next);
      }
    }
  }
  if (order.length !== graph.nodes.length) {
    throw new CanvasGraphValidationError(["工作流存在环"]);
  }
  return order;
}

/** Asset ids referenced by nodes, for tenant ownership validation. */
export function collectCanvasAssetIds(graph: CanvasGraph): string[] {
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (node.data.assetId?.trim()) {
      ids.add(node.data.assetId.trim());
    }
    for (const assetId of node.data.assetIds ?? []) {
      if (typeof assetId === "string" && assetId.trim()) {
        ids.add(assetId.trim());
      }
    }
    for (const reference of node.data.references ?? []) {
      if (reference.assetId?.trim()) {
        ids.add(reference.assetId.trim());
      }
    }
  }
  return [...ids];
}

/** Output media type of a node, used for typed connections. */
export function canvasNodeOutputType(
  type: CanvasNodeType,
): "text" | "image" | "video" | "audio" | null {
  return type === "group" ? null : type;
}
