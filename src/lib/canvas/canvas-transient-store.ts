"use client";

import { create } from "zustand";

/**
 * Transient canvas UI state — never part of the document.
 *
 * These fields used to live in the graph store, which meant an upload tick or a
 * snap-target change woke every node, label and edge selector in the app even
 * though the graph did not change. Keeping them in their own store means an
 * upload at 40 %/s or a drag frame only notifies the few components that
 * actually read this state.
 */
type CanvasTransientState = {
  /** Group highlighted while a node is dragged over it. */
  dragOverGroupId: string | null;
  /** Node the dragged node would auto-connect to. */
  snapTargetId: string | null;
  /** Upload percent per node id (absent when idle). */
  uploadProgressById: Record<string, number>;
  setDragOverGroupId: (groupId: string | null) => void;
  setSnapTargetId: (nodeId: string | null) => void;
  setUploadProgress: (nodeId: string, percent: number | null) => void;
  reset: () => void;
};

const EMPTY_PROGRESS: Record<string, number> = {};

export const useCanvasTransientStore = create<CanvasTransientState>(
  (set, get) => ({
    dragOverGroupId: null,
    snapTargetId: null,
    uploadProgressById: EMPTY_PROGRESS,
    setDragOverGroupId: (groupId) => {
      // Fired on every drag frame; a no-op `set` still notifies subscribers.
      if (get().dragOverGroupId === groupId) {
        return;
      }
      set({ dragOverGroupId: groupId });
    },
    setSnapTargetId: (nodeId) => {
      if (get().snapTargetId === nodeId) {
        return;
      }
      set({ snapTargetId: nodeId });
    },
    setUploadProgress: (nodeId, percent) => {
      const current = get().uploadProgressById;
      const rounded =
        percent === null ? null : Math.max(0, Math.min(100, Math.round(percent)));
      if (rounded === null) {
        if (!(nodeId in current)) {
          return;
        }
        const next = { ...current };
        delete next[nodeId];
        set({ uploadProgressById: next });
        return;
      }
      if (current[nodeId] === rounded) {
        return;
      }
      set({ uploadProgressById: { ...current, [nodeId]: rounded } });
    },
    reset: () => {
      if (
        get().dragOverGroupId === null &&
        get().snapTargetId === null &&
        Object.keys(get().uploadProgressById).length === 0
      ) {
        return;
      }
      set({
        dragOverGroupId: null,
        snapTargetId: null,
        uploadProgressById: EMPTY_PROGRESS,
      });
    },
  }),
);
