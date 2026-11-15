"use client";

import { useStoreWithEqualityFn } from "zustand/traditional";
import { useShallow } from "zustand/react/shallow";

import {
  getGroupableIds,
  getLabelEntries,
  getMediaCounts,
  getMentionEntries,
  getSelection,
  countSelected,
  type CanvasLabelEntry,
  type CanvasMentionEntry,
  type CanvasMediaCounts,
} from "./canvas-derived";
import { getNodeById } from "./canvas-node-index";
import { useCanvasRunStatusStore } from "./canvas-run-status-store";
import { useCanvasTransientStore } from "./canvas-transient-store";
import {
  useCanvasStore,
  type CanvasFlowEdge,
  type CanvasFlowNode,
  type CanvasStore,
} from "./canvas-store";
import type { CanvasSettings } from "@/lib/tu-shared-browser";

/**
 * The only sanctioned way for components to read canvas state.
 *
 * Rules behind this module (see docs/canvas-store.md):
 *
 * 1. Never subscribe to `nodes` / `edges` unless you *render the graph itself*.
 *    Every drag frame replaces the array; anything holding it re-renders.
 * 2. Prefer a derived hook here: each one is cached against the array identity
 *    (`canvas-derived`) so the selector is O(1) after the first reader, and
 *    returns a value whose identity only changes when the value does.
 * 3. Actions are read with `useCanvasStore.getState().action` inside callbacks,
 *    or with `useCanvasAction` when a component needs a stable reference.
 */

/* -------------------------------------------------------------------------- */
/* Graph arrays (only for the graph surface)                                   */
/* -------------------------------------------------------------------------- */

/**
 * The raw node array. **Only** `CanvasFlowSurface` may use this: it owns React
 * Flow's display buffer. Everything else uses the derived hooks below.
 */
export function useCanvasNodes(): CanvasFlowNode[] {
  return useCanvasStore((state) => state.nodes);
}

export function useCanvasEdges(): CanvasFlowEdge[] {
  return useCanvasStore((state) => state.edges);
}

/* -------------------------------------------------------------------------- */
/* O(1) / value-stable readers                                                 */
/* -------------------------------------------------------------------------- */

export function useCanvasNode(nodeId: string): CanvasFlowNode | undefined {
  return useCanvasStore((state) => getNodeById(state.nodes, nodeId));
}

export function useCanvasNodeCount(): number {
  return useCanvasStore((state) => state.nodes.length);
}

export function useCanvasEdgeCount(): number {
  return useCanvasStore((state) => state.edges.length);
}

export function useCanvasSettings(): CanvasSettings {
  return useCanvasStore((state) => state.settings);
}

/** Selected id list + key + the ids that can be grouped. */
export function useCanvasSelection(): {
  key: string;
  ids: string[];
  groupableIds: string[];
} {
  return useCanvasStore(
    useShallow((state) => {
      const selection = getSelection(state.nodes);
      return {
        key: selection.key,
        ids: selection.ids,
        groupableIds: selection.groupableIds,
      };
    }),
  );
}

export function useSelectedIdKey(): string {
  return useCanvasStore((state) => getSelection(state.nodes).key);
}

export function useSelectedCount(): number {
  return useCanvasStore((state) => countSelected(state.nodes));
}

export function useGroupableSelectionCount(): number {
  return useCanvasStore((state) => getGroupableIds(state.nodes).length);
}

export function useCanvasMediaCounts(): CanvasMediaCounts {
  return useCanvasStore(useShallow((state) => getMediaCounts(state.nodes)));
}

/** Cached label snapshot: stable while the drawn label fields are unchanged. */
export function useLabelEntries(): readonly CanvasLabelEntry[] {
  return useCanvasStore(useShallow((state) => getLabelEntries(state.nodes)));
}

/** Cached `@` mention list for the agent composer. */
export function useMentionEntries(): readonly CanvasMentionEntry[] {
  return useCanvasStore(useShallow((state) => getMentionEntries(state.nodes)));
}

/** Nodes currently running or queued, across the graph + run-status stores. */
export function useCanvasRunningTaskCount(): number {
  const statusById = useCanvasRunStatusStore((state) => state.statusById);
  return useCanvasStore((state) => {
    let count = 0;
    for (const node of state.nodes) {
      const status = statusById[node.id]?.status ?? node.data.status;
      if (status === "running" || status === "queued") {
        count += 1;
      }
    }
    return count;
  });
}

/* -------------------------------------------------------------------------- */
/* Transient UI state (own store, never wakes graph readers)                   */
/* -------------------------------------------------------------------------- */

export function useCanvasSnapTarget(nodeId: string): boolean {
  return useCanvasTransientStore((state) => state.snapTargetId === nodeId);
}

export function useCanvasUploadProgress(nodeId: string): number | undefined {
  return useCanvasTransientStore((state) => state.uploadProgressById[nodeId]);
}

export function useCanvasIsUploading(nodeId: string): boolean {
  return useCanvasTransientStore(
    (state) => typeof state.uploadProgressById[nodeId] === "number",
  );
}

export function useCanvasDragOverGroup(groupId: string): boolean {
  return useCanvasTransientStore(
    (state) => state.dragOverGroupId === groupId,
  );
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                     */
/* -------------------------------------------------------------------------- */

/** A stable action reference (zustand actions never change identity). */
export function useCanvasAction<T>(select: (state: CanvasStore) => T): T {
  return useStoreWithEqualityFn(useCanvasStore, select, Object.is);
}
