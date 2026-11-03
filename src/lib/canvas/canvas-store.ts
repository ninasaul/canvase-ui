"use client";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type XYPosition,
} from "@xyflow/react";
import {
  parseCanvasGraph,
  type CanvasEdgeRole,
  type CanvasGraph,
  type CanvasNodeData,
  type CanvasNodeType,
  type CanvasSettings,
} from "@/lib/tu-shared-browser";
import { normalizeNodeDataForPersistence } from "./canvas-graph";
import { create } from "zustand";
import { messages } from "@/messages";
import { canvasNodeSizeFromData } from "./canvas-node-size";
import { defaultEdgeRole } from "./canvas-edge-roles";

export type CanvasFlowNode = Node<CanvasNodeData, CanvasNodeType>;
export type CanvasFlowEdge = Edge<{
  role: CanvasEdgeRole;
  order?: number;
}>;

export type CanvasStore = {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  settings: CanvasSettings;
  dragOverGroupId: string | null;
  snapTargetId: string | null;
  uploadProgressById: Record<string, number>;
  onNodesChange: (changes: NodeChange<CanvasFlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<CanvasFlowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  setEdgeRole: (edgeId: string, role: CanvasEdgeRole) => void;
  addNode: (
    type: CanvasNodeType,
    position?: XYPosition,
    data?: Partial<CanvasNodeData>,
  ) => void;
  addMediaNode: (
    type: "image" | "video" | "audio",
    url: string,
    assetId: string | undefined,
    position: XYPosition,
    source?: "library" | "upload",
    thumbnailUrl?: string,
  ) => void;
  updateNodeData: (id: string, patch: Partial<CanvasNodeData>) => void;
  setNodeSize: (id: string, width: number, height: number) => void;
  setNodePosition: (id: string, x: number, y: number) => void;
  selectNode: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  groupSelection: (nodeIds: string[], label: string) => void;
  addNodesToGroup: (groupId: string, nodeIds: string[]) => void;
  removeNodeFromGroup: (nodeId: string) => void;
  ungroup: (groupId: string) => void;
  removeNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  replace: (nodes: CanvasFlowNode[], edges: CanvasFlowEdge[]) => void;
  setSettings: (settings: CanvasSettings) => void;
  setDragOverGroupId: (groupId: string | null) => void;
  setSnapTargetId: (nodeId: string | null) => void;
  setUploadProgress: (nodeId: string, percent: number | null) => void;
  reset: (graph?: CanvasGraph) => void;
  toGraph: () => CanvasGraph;
};

const nodeDefaults: Record<CanvasNodeType, CanvasNodeData> = {
  text: { label: "", text: "" },
  image: { label: "", prompt: "", status: "idle" },
  video: { label: "", prompt: "", status: "idle" },
  audio: { label: "", status: "idle" },
  group: { label: "" },
};

const nodeSizes: Record<CanvasNodeType, { width: number; height: number }> = {
  text: { width: 220, height: 120 },
  image: { width: 240, height: 242 },
  video: { width: 280, height: 160 },
  audio: { width: 220, height: 120 },
  group: { width: 360, height: 280 },
};

/** Inner padding so children clear the group title strip. */
const GROUP_PAD_X = 24;
const GROUP_PAD_TOP = 40;
const GROUP_PAD_BOTTOM = 24;

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function nodeSizeOf(node: CanvasFlowNode): { width: number; height: number } {
  return {
    width: node.width ?? node.measured?.width ?? nodeSizes[node.type].width,
    height: node.height ?? node.measured?.height ?? nodeSizes[node.type].height,
  };
}

/** React Flow requires parent nodes to appear before their children. */
function orderNodesParentsFirst(nodes: CanvasFlowNode[]): CanvasFlowNode[] {
  const groups: CanvasFlowNode[] = [];
  const rest: CanvasFlowNode[] = [];
  for (const node of nodes) {
    if (node.type === "group") {
      groups.push(node);
    } else {
      rest.push(node);
    }
  }
  return [...groups, ...rest];
}

/**
 * Place a free node into a group without blowing up the group bounds.
 * Keeps the visual position when it already fits; otherwise clamps into
 * the padded box and only grows the group if the child cannot fit.
 */
function placeNodeInGroup(
  group: CanvasFlowNode,
  node: CanvasFlowNode,
  groupWidth: number,
  groupHeight: number,
): {
  position: { x: number; y: number };
  groupWidth: number;
  groupHeight: number;
  width: number;
  height: number;
} {
  const { width, height } = nodeSizeOf(node);
  let nextWidth = Math.max(groupWidth, width + GROUP_PAD_X * 2);
  let nextHeight = Math.max(
    groupHeight,
    height + GROUP_PAD_TOP + GROUP_PAD_BOTTOM,
  );

  let relX = node.position.x - group.position.x;
  let relY = node.position.y - group.position.y;
  const maxX = Math.max(GROUP_PAD_X, nextWidth - width - GROUP_PAD_X);
  const maxY = Math.max(GROUP_PAD_TOP, nextHeight - height - GROUP_PAD_BOTTOM);
  relX = Math.min(Math.max(relX, GROUP_PAD_X), maxX);
  relY = Math.min(Math.max(relY, GROUP_PAD_TOP), maxY);

  nextWidth = Math.max(nextWidth, relX + width + GROUP_PAD_X);
  nextHeight = Math.max(nextHeight, relY + height + GROUP_PAD_BOTTOM);

  return {
    position: { x: relX, y: relY },
    groupWidth: nextWidth,
    groupHeight: nextHeight,
    width,
    height,
  };
}

export function createCanvasNode(
  type: CanvasNodeType,
  position: XYPosition,
): CanvasFlowNode {
  const size = nodeSizes[type];
  return {
    id: newId(type),
    type,
    position,
    width: size.width,
    height: size.height,
    data: { ...nodeDefaults[type] },
  };
}

function styleDimension(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function graphFromState(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  settings: CanvasSettings,
): CanvasGraph {
  const selection = nodes
    .filter((node) => node.selected)
    .map((node) => node.id);
  return {
    schemaVersion: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: { x: node.position.x, y: node.position.y },
      data: normalizeNodeDataForPersistence(node.data),
      ...(node.width !== undefined
        ? { width: node.width }
        : styleDimension(node.style?.width) !== undefined
          ? { width: styleDimension(node.style?.width) }
          : {}),
      ...(node.height !== undefined
        ? { height: node.height }
        : styleDimension(node.style?.height) !== undefined
          ? { height: styleDimension(node.style?.height) }
          : {}),
      ...(node.parentId !== undefined ? { parentId: node.parentId } : {}),
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(edge.sourceHandle !== null && edge.sourceHandle !== undefined
        ? { sourceHandle: edge.sourceHandle }
        : {}),
      ...(edge.targetHandle !== null && edge.targetHandle !== undefined
        ? { targetHandle: edge.targetHandle }
        : {}),
      ...(edge.data ? { data: edge.data } : {}),
    })),
    ...(Object.keys(settings).length > 0 ? { settings } : {}),
    ...(selection.length > 0 ? { selection } : {}),
  };
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: [],
  edges: [],
  settings: {},
  dragOverGroupId: null,
  snapTargetId: null,
  uploadProgressById: {},

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    const source = get().nodes.find((node) => node.id === connection.source);
    const target = get().nodes.find((node) => node.id === connection.target);
    const targetHandle = connection.targetHandle ?? "";
    const resolved =
      targetHandle === "in" && source && target
        ? defaultEdgeRole(source.type, target.type)
        : (targetHandle as CanvasEdgeRole);
    const role = resolved ?? "prompt";
    set({
      edges: addEdge(
        {
          ...connection,
          id: newId("edge"),
          type: "canvas",
          data: { role },
        },
        get().edges,
      ),
    });
  },

  setEdgeRole: (edgeId, role) => {
    set({
      edges: get().edges.map((edge) =>
        edge.id === edgeId
          ? { ...edge, data: { ...edge.data, role } }
          : edge,
      ),
    });
  },

  addNode: (type, position = { x: 80, y: 80 }, data) => {
    const node = createCanvasNode(type, position);
    if (data) {
      node.data = { ...node.data, ...data };
    }
    if (!node.data.url) {
      const sized = canvasNodeSizeFromData(type, node.data);
      if (sized) {
        node.width = sized.width;
        node.height = sized.height;
      }
    }
    set({ nodes: [...get().nodes, node] });
  },

  addMediaNode: (
    type,
    url,
    assetId,
    position,
    source = "library",
    thumbnailUrl,
  ) => {
    const node = createCanvasNode(type, position);
    node.data = {
      ...node.data,
      source,
      url,
      urls: [url],
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
      ...(assetId ? { assetId, assetIds: [assetId] } : {}),
      status: "succeeded",
    };
    set({ nodes: [...get().nodes, node] });
  },

  updateNodeData: (id, patch) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...patch } } : node,
      ),
    });
  },

  setNodeSize: (id, width, height) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === id ? { ...node, width, height } : node,
      ),
    });
  },

  setNodePosition: (id, x, y) => {
    const nodes = get().nodes;
    const node = nodes.find((item) => item.id === id);
    if (!node) {
      return;
    }
    let nextX = x;
    let nextY = y;
    if (node.parentId) {
      const parent = nodes.find((item) => item.id === node.parentId);
      if (parent) {
        const { width, height } = nodeSizeOf(node);
        const parentWidth = parent.width ?? parent.measured?.width ?? 360;
        const parentHeight = parent.height ?? parent.measured?.height ?? 280;
        const maxX = Math.max(GROUP_PAD_X, parentWidth - width - GROUP_PAD_X);
        const maxY = Math.max(
          GROUP_PAD_TOP,
          parentHeight - height - GROUP_PAD_BOTTOM,
        );
        nextX = Math.min(Math.max(nextX, GROUP_PAD_X), maxX);
        nextY = Math.min(Math.max(nextY, GROUP_PAD_TOP), maxY);
      }
    }
    set({
      nodes: nodes.map((item) =>
        item.id === id ? { ...item, position: { x: nextX, y: nextY } } : item,
      ),
    });
  },

  selectNode: (id) => {
    // Copy only the nodes whose selection actually changes. Re-creating every
    // node object here invalidated the identity check React Flow uses to skip
    // unchanged nodes, so a single click re-rendered the whole graph.
    set({
      nodes: get().nodes.map((node) => {
        const selected = node.id === id;
        return node.selected === selected ? node : { ...node, selected };
      }),
    });
  },

  selectAll: () => {
    set({
      nodes: get().nodes.map((node) =>
        node.selected ? node : { ...node, selected: true },
      ),
    });
  },

  clearSelection: () => {
    set({
      nodes: get().nodes.map((node) =>
        node.selected ? { ...node, selected: false } : node,
      ),
    });
  },

  removeNode: (id) => {
    const nodes = get().nodes;
    const node = nodes.find((item) => item.id === id);
    if (node?.type === "group") {
      const children = nodes
        .filter((item) => item.parentId === id)
        .map((item) => ({
          ...item,
          parentId: undefined,
          extent: undefined,
          position: {
            x: node.position.x + item.position.x,
            y: node.position.y + item.position.y,
          },
        }));
      set({
        nodes: [
          ...nodes.filter((item) => item.id !== id && item.parentId !== id),
          ...children,
        ],
      });
      return;
    }
    const uploadProgressById = { ...get().uploadProgressById };
    delete uploadProgressById[id];
    set({
      nodes: nodes.filter((item) => item.id !== id),
      edges: get().edges.filter(
        (edge) => edge.source !== id && edge.target !== id,
      ),
      uploadProgressById,
    });
  },

  duplicateNode: (id) => {
    const nodes = get().nodes;
    const source = nodes.find((node) => node.id === id);
    if (!source) {
      return;
    }

    if (source.type === "group") {
      const groupId = newId("group");
      const children = nodes.filter((node) => node.parentId === id);
      const idMap = new Map(
        children.map((child) => [child.id, newId(child.type ?? "text")]),
      );
      const groupCopy: CanvasFlowNode = {
        ...source,
        id: groupId,
        position: {
          x: source.position.x + 32,
          y: source.position.y + 32,
        },
        selected: false,
        data: { ...source.data },
      };
      const childCopies = children.map((child) => ({
        ...child,
        id: idMap.get(child.id)!,
        parentId: groupId,
        selected: false,
        data: { ...child.data },
      }));
      const childIds = new Set(children.map((child) => child.id));
      const edgeCopies = get()
        .edges.filter(
          (edge) => childIds.has(edge.source) && childIds.has(edge.target),
        )
        .map((edge) => ({
          ...edge,
          id: newId("edge"),
          source: idMap.get(edge.source)!,
          target: idMap.get(edge.target)!,
          selected: false,
        }));
      set({
        nodes: [...nodes, groupCopy, ...childCopies],
        edges: [...get().edges, ...edgeCopies],
      });
      return;
    }

    const copy: CanvasFlowNode = {
      ...source,
      id: newId(source.type ?? "text"),
      position: {
        x: source.position.x + 32,
        y: source.position.y + 32,
      },
      selected: false,
      data: { ...source.data },
    };
    set({ nodes: [...nodes, copy] });
  },

  groupSelection: (nodeIds, label) => {
    const nodes = get().nodes;
    const selected = nodes.filter(
      (node) =>
        nodeIds.includes(node.id) && node.type !== "group" && !node.parentId,
    );
    if (selected.length < 2) {
      return;
    }
    const bounds = selected.map((node) => {
      const width =
        node.width ?? node.measured?.width ?? nodeSizes[node.type].width;
      const height =
        node.height ?? node.measured?.height ?? nodeSizes[node.type].height;
      return {
        x: node.position.x,
        y: node.position.y,
        right: node.position.x + width,
        bottom: node.position.y + height,
      };
    });
    const minX = Math.min(...bounds.map((item) => item.x));
    const minY = Math.min(...bounds.map((item) => item.y));
    const maxX = Math.max(...bounds.map((item) => item.right));
    const maxY = Math.max(...bounds.map((item) => item.bottom));
    const groupX = minX - GROUP_PAD_X;
    const groupY = minY - GROUP_PAD_TOP;
    const groupWidth = Math.max(320, maxX - minX + GROUP_PAD_X * 2);
    const groupHeight = Math.max(
      220,
      maxY - minY + GROUP_PAD_TOP + GROUP_PAD_BOTTOM,
    );
    const groupId = newId("group");
    const group: CanvasFlowNode = {
      id: groupId,
      type: "group",
      position: { x: groupX, y: groupY },
      width: groupWidth,
      height: groupHeight,
      selected: true,
      data: { label: label.trim() || messages.canvas.groupDefault },
      style: { zIndex: 0 },
    };
    const selectedIds = new Set(selected.map((node) => node.id));
    set({
      nodes: orderNodesParentsFirst([
        group,
        ...nodes.map((node) => {
          if (!selectedIds.has(node.id)) {
            return node;
          }
          const { width, height } = nodeSizeOf(node);
          return {
            ...node,
            parentId: groupId,
            extent: "parent" as const,
            zIndex: 1,
            selected: false,
            width,
            height,
            position: {
              x: node.position.x - groupX,
              y: node.position.y - groupY,
            },
          };
        }),
      ]),
    });
  },

  addNodesToGroup: (groupId, nodeIds) => {
    const nodes = get().nodes;
    const group = nodes.find((node) => node.id === groupId);
    if (!group || group.type !== "group") {
      return;
    }
    let nextWidth = group.width ?? nodeSizes.group.width;
    let nextHeight = group.height ?? nodeSizes.group.height;
    const selected = nodes.filter(
      (node) =>
        nodeIds.includes(node.id) &&
        node.type !== "group" &&
        !node.parentId,
    );
    if (selected.length === 0) {
      return;
    }
    const placements = new Map<
      string,
      { position: { x: number; y: number }; width: number; height: number }
    >();
    for (const node of selected) {
      const placed = placeNodeInGroup(group, node, nextWidth, nextHeight);
      nextWidth = placed.groupWidth;
      nextHeight = placed.groupHeight;
      placements.set(node.id, {
        position: placed.position,
        width: placed.width,
        height: placed.height,
      });
    }
    const updated = nodes.map((node) => {
      const placed = placements.get(node.id);
      if (!placed) {
        return node;
      }
      return {
        ...node,
        parentId: groupId,
        extent: "parent" as const,
        zIndex: 1,
        width: placed.width,
        height: placed.height,
        position: placed.position,
      };
    });
    set({
      nodes: orderNodesParentsFirst(
        updated.map((node) =>
          node.id === groupId
            ? { ...node, width: nextWidth, height: nextHeight }
            : node,
        ),
      ),
    });
  },

  removeNodeFromGroup: (nodeId) => {
    const nodes = get().nodes;
    const node = nodes.find((item) => item.id === nodeId);
    if (!node?.parentId) {
      return;
    }
    const parent = nodes.find((item) => item.id === node.parentId);
    set({
      nodes: nodes.map((item) =>
        item.id === nodeId
          ? {
              ...item,
              parentId: undefined,
              extent: undefined,
              zIndex: undefined,
              position: {
                x: (parent?.position.x ?? 0) + item.position.x,
                y: (parent?.position.y ?? 0) + item.position.y,
              },
            }
          : item,
      ),
    });
  },

  ungroup: (groupId) => {
    const nodes = get().nodes;
    const group = nodes.find((node) => node.id === groupId);
    if (!group || group.type !== "group") {
      return;
    }
    const children = nodes
      .filter((node) => node.parentId === groupId)
      .map((node) => ({
        ...node,
        parentId: undefined,
        extent: undefined,
        position: {
          x: group.position.x + node.position.x,
          y: group.position.y + node.position.y,
        },
      }));
    set({
      nodes: [
        ...nodes.filter(
          (node) => node.id !== groupId && node.parentId !== groupId,
        ),
        ...children,
      ],
    });
  },

  replace: (nodes, edges) => {
    set({ nodes, edges });
  },

  setSettings: (settings) => {
    set({ settings });
  },

  setDragOverGroupId: (groupId) => {
    set({ dragOverGroupId: groupId });
  },

  setSnapTargetId: (nodeId) => {
    if (get().snapTargetId !== nodeId) {
      set({ snapTargetId: nodeId });
    }
  },

  setUploadProgress: (nodeId, percent) => {
    set((state) => {
      const next = { ...state.uploadProgressById };
      if (percent === null) {
        delete next[nodeId];
      } else {
        next[nodeId] = Math.max(0, Math.min(100, Math.round(percent)));
      }
      return { uploadProgressById: next };
    });
  },

  reset: (graph) => {
    if (!graph) {
      set({
        nodes: [],
        edges: [],
        settings: {},
        dragOverGroupId: null,
        snapTargetId: null,
        uploadProgressById: {},
      });
      return;
    }
    const parsed = parseCanvasGraph(graph);
    const selectedIds = new Set(parsed.selection ?? []);
    set({
      nodes: orderNodesParentsFirst(
        parsed.nodes.map((node) => ({
          ...node,
          selected: selectedIds.has(node.id),
          data: { ...node.data },
          ...(node.parentId
            ? { extent: "parent" as const, zIndex: 1 }
            : {}),
          ...(node.type === "group" ? { style: { zIndex: 0 } } : {}),
        })),
      ),
      edges: parsed.edges.map((edge) => {
        const target = parsed.nodes.find((node) => node.id === edge.target);
        const targetHandle =
          target &&
          (target.type === "image" ||
            target.type === "video" ||
            target.type === "audio")
            ? "in"
            : edge.targetHandle;
        return {
          ...edge,
          type: "canvas",
          ...(targetHandle !== undefined ? { targetHandle } : {}),
          data: edge.data ?? { role: "prompt" },
        };
      }),
      settings: parsed.settings ?? {},
      dragOverGroupId: null,
      snapTargetId: null,
      uploadProgressById: {},
    });
  },

  toGraph: () => graphFromState(get().nodes, get().edges, get().settings),
}));
