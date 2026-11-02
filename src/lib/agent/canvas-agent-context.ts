import type { CanvasGraph, CanvasGraphNode } from "@/lib/canvas/canvas-graph";

/** What the client knows about the user's current view; all optional. */
export type CanvasAgentContextInput = {
  /** Graph version the browser last rendered (detects staleness). */
  version?: number;
  /** Currently selected node ids (groups included). */
  selection?: string[];
  /** Node whose config panel is open. */
  focusNodeId?: string;
  /** Nodes inside the viewport, in reading order. */
  visibleNodeIds?: string[];
};

const MAX_IDS = 40;
const MAX_ID_LENGTH = 80;

function readIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const id = item.trim();
    if (!id || id.length > MAX_ID_LENGTH || seen.has(id)) {
      continue;
    }
    seen.add(id);
    if (seen.size >= MAX_IDS) {
      break;
    }
  }
  return [...seen];
}

export function sanitizeCanvasAgentContext(
  raw: unknown,
): CanvasAgentContextInput | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const version =
    typeof record.version === "number" && Number.isFinite(record.version)
      ? Math.trunc(record.version)
      : undefined;
  const focusNodeId =
    typeof record.focusNodeId === "string" && record.focusNodeId.trim()
      ? record.focusNodeId.trim().slice(0, MAX_ID_LENGTH)
      : undefined;
  const selection = readIds(record.selection);
  const visibleNodeIds = readIds(record.visibleNodeIds);
  if (
    version === undefined &&
    !focusNodeId &&
    selection.length === 0 &&
    visibleNodeIds.length === 0
  ) {
    return null;
  }
  return {
    ...(version !== undefined ? { version } : {}),
    ...(selection.length > 0 ? { selection } : {}),
    ...(focusNodeId ? { focusNodeId } : {}),
    ...(visibleNodeIds.length > 0 ? { visibleNodeIds } : {}),
  };
}

function typeLabel(node: CanvasGraphNode): string {
  const data = node.data ?? {};
  const model = typeof data.model === "string" ? data.model.trim() : "";
  const suffix = model ? `, ${model}` : "";
  return `${node.type}${suffix}`;
}

function nodeLabel(node: CanvasGraphNode): string {
  const label = typeof node.data?.label === "string" ? node.data.label.trim() : "";
  if (label) {
    return label;
  }
  return node.type === "group" ? "分组" : node.type;
}

function describeNode(
  node: CanvasGraphNode,
  childCount: Map<string, number>,
): string {
  const label = nodeLabel(node);
  if (node.type === "group") {
    return `${node.id} "${label}"（分组，${childCount.get(node.id) ?? 0} 个子节点）`;
  }
  return `${node.id} "${label}"（${typeLabel(node)}）`;
}

/**
 * Token-cheap digest of the canvas state, rebuilt for every turn.
 * It replaces the mandatory `canvas_get` round trip at the start of a session.
 */
export function buildCanvasAgentContextLines(input: {
  title: string;
  version: number;
  graph: CanvasGraph;
  context?: CanvasAgentContextInput | null;
}): string[] {
  const { graph } = input;
  const nodes = graph.nodes;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const childCount = new Map<string, number>();
  for (const node of nodes) {
    if (node.parentId) {
      childCount.set(node.parentId, (childCount.get(node.parentId) ?? 0) + 1);
    }
  }

  const groups = nodes.filter((node) => node.type === "group");
  const failed = nodes.filter(
    (node) =>
      node.data?.status === "failed" || node.data?.status === "interrupted",
  );
  const running = nodes.filter(
    (node) =>
      node.data?.status === "running" || node.data?.status === "queued",
  );

  const lines: string[] = ["## 当前画布（每轮自动刷新，无需先调用 canvas_get）"];
  lines.push(
    `画布 "${input.title}" · v${input.version} · ${nodes.length} 节点 · ${groups.length} 分组${
      failed.length > 0 ? ` · ${failed.length} 个失败/中断待处理` : ""
    }${running.length > 0 ? ` · ${running.length} 个运行中` : ""}`,
  );

  if (groups.length > 0) {
    const listed = groups
      .slice(0, 6)
      .map(
        (group) =>
          `${group.id} "${nodeLabel(group)}"(${childCount.get(group.id) ?? 0})`,
      );
    lines.push(`分组: ${listed.join(" · ")}${groups.length > 6 ? " …" : ""}`);
  }

  const context = input.context;
  if (context?.selection?.length) {
    const selected = context.selection
      .map((id) => byId.get(id))
      .filter((node): node is CanvasGraphNode => Boolean(node))
      .slice(0, 6)
      .map((node) => describeNode(node, childCount));
    if (selected.length > 0) {
      lines.push(`用户选中 ${selected.length} 个: ${selected.join(" · ")}`);
    }
  }

  if (context?.focusNodeId) {
    const focus = byId.get(context.focusNodeId);
    if (focus) {
      lines.push(`当前焦点: ${describeNode(focus, childCount)}`);
    }
  }

  if (context?.visibleNodeIds?.length) {
    const visible = context.visibleNodeIds
      .map((id) => byId.get(id))
      .filter((node): node is CanvasGraphNode => Boolean(node))
      .slice(0, 10)
      .map((node) => node.id);
    if (visible.length > 0) {
      lines.push(`视口内: ${visible.join(", ")}`);
    }
  }

  if (failed.length > 0) {
    const ids = failed.slice(0, 8).map((node) => node.id);
    lines.push(`失败/中断: ${ids.join(", ")}${failed.length > 8 ? " …" : ""}`);
  }

  if (
    context?.version !== undefined &&
    context.version !== input.version
  ) {
    lines.push(
      `注意: 浏览器停在 v${context.version}，服务端已是 v${input.version}，写操作请以工具返回的版本为准。`,
    );
  }

  lines.push(
    "需要完整参数/连线时用 canvas_get；只改一个节点时用 canvas_get_node。",
  );
  return lines;
}
