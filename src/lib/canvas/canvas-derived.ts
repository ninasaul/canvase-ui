"use client";

import type { CanvasFlowEdge, CanvasFlowNode } from "./canvas-store";
import { getNodeById } from "./canvas-node-index";

/**
 * Cached selections over the node / edge arrays.
 *
 * Zustand runs every subscriber's selector on each store update, so a selector
 * that walks the whole graph is O(n) *per subscriber* — with a handful of
 * consumers that turned a single drag frame (one `set` per mousemove) into
 * dozens of scans over 100+ nodes. Every helper here is cached against the
 * array identity: the first reader pays O(n), the rest are O(1) until the
 * array is replaced.
 *
 * Returning the cached value also keeps identity stable for `useShallow`
 * comparisons, so a component watching a summary does not re-render when the
 * summary is unchanged.
 */

export const EMPTY_NODES: CanvasFlowNode[] = [];
export const EMPTY_EDGES: CanvasFlowEdge[] = [];
export const EMPTY_IDS: string[] = [];

export type CanvasSelectionSummary = {
  ids: string[];
  /** Comma-joined selection, for cheap string comparisons. */
  key: string;
  /** Ids of selected nodes that can be grouped: no groups, nothing nested. */
  groupableIds: string[];
  /** Same nodes, for callers that genuinely need the objects. */
  groupable: CanvasFlowNode[];
};

const selectionCache = new WeakMap<
  readonly CanvasFlowNode[],
  CanvasSelectionSummary
>();

export function getSelection(
  nodes: readonly CanvasFlowNode[],
): CanvasSelectionSummary {
  const cached = selectionCache.get(nodes);
  if (cached) {
    return cached;
  }
  const ids: string[] = [];
  const groupableIds: string[] = [];
  const groupable: CanvasFlowNode[] = [];
  for (const node of nodes) {
    if (!node.selected) {
      continue;
    }
    ids.push(node.id);
    if (node.type !== "group" && !node.parentId) {
      groupableIds.push(node.id);
      groupable.push(node);
    }
  }
  const summary: CanvasSelectionSummary = {
    ids,
    key: ids.join(","),
    groupableIds,
    groupable,
  };
  selectionCache.set(nodes, summary);
  return summary;
}

export function getSelectedIdKey(nodes: readonly CanvasFlowNode[]): string {
  return getSelection(nodes).key;
}

export function countSelected(nodes: readonly CanvasFlowNode[]): number {
  return getSelection(nodes).ids.length;
}

export function getGroupableSelection(
  nodes: readonly CanvasFlowNode[],
): CanvasFlowNode[] {
  return getSelection(nodes).groupable;
}

/**
 * Ids of the groupable selection. Components that only need "how many / which"
 * should use this: the id strings stay identical while the selected nodes are
 * edited, whereas the node objects are replaced on every keystroke.
 */
export function getGroupableIds(
  nodes: readonly CanvasFlowNode[],
): string[] {
  return getSelection(nodes).groupableIds;
}

export function getSelectedIds(
  nodes: readonly CanvasFlowNode[],
): string[] {
  return getSelection(nodes).ids;
}

const childrenCache = new WeakMap<
  readonly CanvasFlowNode[],
  Map<string, CanvasFlowNode[]>
>();

function childrenIndex(
  nodes: readonly CanvasFlowNode[],
): Map<string, CanvasFlowNode[]> {
  const cached = childrenCache.get(nodes);
  if (cached) {
    return cached;
  }
  const index = new Map<string, CanvasFlowNode[]>();
  for (const node of nodes) {
    const parentId = node.parentId;
    if (!parentId) {
      continue;
    }
    const bucket = index.get(parentId);
    if (bucket) {
      bucket.push(node);
    } else {
      index.set(parentId, [node]);
    }
  }
  childrenCache.set(nodes, index);
  return index;
}

export function getChildrenOf(
  nodes: readonly CanvasFlowNode[],
  parentId: string,
): CanvasFlowNode[] {
  return childrenIndex(nodes).get(parentId) ?? EMPTY_NODES;
}

/** Resolve a node and its group parent in one cached lookup. */
export function getNodeWithParent(
  nodes: readonly CanvasFlowNode[],
  nodeId: string,
): { node?: CanvasFlowNode; parent?: CanvasFlowNode } {
  const node = getNodeById(nodes, nodeId);
  const parent = node?.parentId ? getNodeById(nodes, node.parentId) : undefined;
  return { node, parent };
}

export type GroupChildSummary = {
  count: number;
  busy: boolean;
  maxWidth: number;
  maxHeight: number;
  /** Comma-joined ids of children a batch run can execute. */
  runnableKey: string;
  runnableIds: string[];
};

const groupSummaryCache = new WeakMap<
  readonly CanvasFlowNode[],
  Map<string, GroupChildSummary>
>();

/** Aggregate of a group's children, computed once per store version. */
export function getGroupChildSummary(
  nodes: readonly CanvasFlowNode[],
  groupId: string,
): GroupChildSummary {
  let perGroup = groupSummaryCache.get(nodes);
  if (!perGroup) {
    perGroup = new Map();
    groupSummaryCache.set(nodes, perGroup);
  }
  const cached = perGroup.get(groupId);
  if (cached) {
    return cached;
  }
  let count = 0;
  let busy = false;
  let maxWidth = 0;
  let maxHeight = 0;
  const runnableIds: string[] = [];
  for (const node of getChildrenOf(nodes, groupId)) {
    const width = node.width ?? node.measured?.width ?? 220;
    const height = node.height ?? node.measured?.height ?? 120;
    count += 1;
    maxWidth = Math.max(maxWidth, Math.ceil(node.position.x + width + 24));
    maxHeight = Math.max(maxHeight, Math.ceil(node.position.y + height + 24));
    if (node.data.status === "running" || node.data.status === "queued") {
      busy = true;
    }
    if (
      node.type === "image" ||
      node.type === "video" ||
      node.type === "text"
    ) {
      runnableIds.push(node.id);
    }
  }
  const summary: GroupChildSummary = {
    count,
    busy,
    maxWidth,
    maxHeight,
    runnableKey: runnableIds.join(","),
    runnableIds,
  };
  perGroup.set(groupId, summary);
  return summary;
}

export type CanvasMediaCounts = { images: number; videos: number };

const mediaCountCache = new WeakMap<readonly CanvasFlowNode[], CanvasMediaCounts>();

/** Number of downloadable image / video nodes, cached per store version. */
export function getMediaCounts(
  nodes: readonly CanvasFlowNode[],
): CanvasMediaCounts {
  const cached = mediaCountCache.get(nodes);
  if (cached) {
    return cached;
  }
  let images = 0;
  let videos = 0;
  for (const node of nodes) {
    if (!node.data.url && !node.data.urls?.length && !node.data.assetId) {
      continue;
    }
    if (node.type === "image") {
      images += 1;
    } else if (node.type === "video") {
      videos += 1;
    }
  }
  const counts = { images, videos };
  mediaCountCache.set(nodes, counts);
  return counts;
}

const runningCountCache = new WeakMap<
  readonly CanvasFlowNode[],
  WeakMap<object, number>
>();

/** Nodes currently running or queued, cached per (nodes, statusById) pair. */
export function getRunningTaskCount(
  nodes: readonly CanvasFlowNode[],
  statusById: Record<string, { status?: string } | undefined>,
): number {
  let perStatus = runningCountCache.get(nodes);
  if (!perStatus) {
    perStatus = new WeakMap();
    runningCountCache.set(nodes, perStatus);
  }
  const cached = perStatus.get(statusById);
  if (cached !== undefined) {
    return cached;
  }
  let count = 0;
  for (const node of nodes) {
    const status = statusById[node.id]?.status ?? node.data.status;
    if (status === "running" || status === "queued") {
      count += 1;
    }
  }
  perStatus.set(statusById, count);
  return count;
}

export type CanvasMentionEntry = {
  id: string;
  label: string;
  type: CanvasFlowNode["type"];
};

const mentionEntryCache = new Map<
  string,
  { signature: string; entry: CanvasMentionEntry }
>();
const mentionListCache = new WeakMap<
  readonly CanvasFlowNode[],
  readonly CanvasMentionEntry[]
>();

function mentionEntryOf(node: CanvasFlowNode): CanvasMentionEntry {
  const label = node.data.label?.trim() || node.id;
  // Node objects are replaced whenever *any* field changes (typing a prompt, a
  // status tick), and the replacement must not invalidate the entry — cache by
  // node id and compare the fields the entry actually renders.
  const signature = `${node.type}\u0000${label}`;
  const cached = mentionEntryCache.get(node.id);
  if (cached && cached.signature === signature) {
    return cached.entry;
  }
  const entry: CanvasMentionEntry = { id: node.id, label, type: node.type };
  mentionEntryCache.set(node.id, { signature, entry });
  return entry;
}

/**
 * `@` mention candidates for the agent composer. Entries are cached per node,
 * so the array only re-renders a stable shallow comparison when a label (or
 * the node set) actually changes.
 */
export function getMentionEntries(
  nodes: readonly CanvasFlowNode[],
): readonly CanvasMentionEntry[] {
  const cached = mentionListCache.get(nodes);
  if (cached) {
    return cached;
  }
  if (mentionEntryCache.size > nodes.length * 2 + 200) {
    const alive = new Set(nodes.map((node) => node.id));
    for (const id of mentionEntryCache.keys()) {
      if (!alive.has(id)) {
        mentionEntryCache.delete(id);
      }
    }
  }
  const entries = nodes.map(mentionEntryOf);
  mentionListCache.set(nodes, entries);
  return entries;
}

const mediaUrlCache = new WeakMap<readonly CanvasFlowNode[], string[]>();

/** Every media url already present on the canvas (deduplicated). */
export function getCanvasMediaUrls(
  nodes: readonly CanvasFlowNode[],
): string[] {
  const cached = mediaUrlCache.get(nodes);
  if (cached) {
    return cached;
  }
  const seen = new Set<string>();
  for (const node of nodes) {
    for (const url of [node.data.url, ...(node.data.urls ?? [])]) {
      const trimmed = url?.trim();
      if (trimmed) {
        seen.add(trimmed);
      }
    }
  }
  const urls = Array.from(seen);
  mediaUrlCache.set(nodes, urls);
  return urls;
}

export type CanvasLabelEntry = {
  /** Node snapshot for rendering; kept stable while the label is unchanged. */
  node: CanvasFlowNode;
};

const labelEntryCache = new Map<
  string,
  { signature: string; entry: CanvasLabelEntry }
>();
const labelListCache = new WeakMap<
  readonly CanvasFlowNode[],
  readonly CanvasLabelEntry[]
>();

function labelSignatureOf(node: CanvasFlowNode): string {
  return [
    node.id,
    node.type,
    node.parentId ?? "",
    node.selected ? "1" : "0",
    node.position.x,
    node.position.y,
    node.width ?? node.measured?.width ?? "",
    node.height ?? node.measured?.height ?? "",
    node.data.label ?? "",
    node.data.status ?? "",
    node.data.model ?? "",
  ].join("\u0000");
}

function labelEntryOf(node: CanvasFlowNode): CanvasLabelEntry {
  const signature = labelSignatureOf(node);
  // Cache by id: a prompt keystroke replaces the node object but leaves every
  // field the label draws untouched, so the label keeps its identity.
  const cached = labelEntryCache.get(node.id);
  if (cached && cached.signature === signature) {
    return cached.entry;
  }
  // Only the fields the label layer draws — a prompt keystroke replaces the
  // node object but leaves every one of them untouched, so the label keeps its
  // identity and the layer does not re-render.
  const entry: CanvasLabelEntry = {
    node: {
      ...node,
      data: {
        label: node.data.label,
        status: node.data.status,
        model: node.data.model,
      },
    },
  };
  labelEntryCache.set(node.id, { signature, entry });
  return entry;
}

/**
 * Snapshot of the fields the canvas labels render, cached per node and per
 * array so `useShallow` can skip label re-renders for data-only edits.
 */
export function getLabelEntries(
  nodes: readonly CanvasFlowNode[],
): readonly CanvasLabelEntry[] {
  const cached = labelListCache.get(nodes);
  if (cached) {
    return cached;
  }
  if (labelEntryCache.size > nodes.length * 2 + 200) {
    const alive = new Set(nodes.map((node) => node.id));
    for (const id of labelEntryCache.keys()) {
      if (!alive.has(id)) {
        labelEntryCache.delete(id);
      }
    }
  }
  const entries = nodes.map(labelEntryOf);
  labelListCache.set(nodes, entries);
  return entries;
}
