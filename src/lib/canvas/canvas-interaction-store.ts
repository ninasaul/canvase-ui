"use client";

import { create } from "zustand";

type CanvasInteractionState = {
  draggingNode: boolean;
  /** Node ids currently being dragged (includes multi-select movers). */
  draggingNodeIds: string[];
  /**
   * Every node that actually moves during the gesture: the dragged ids plus
   * the descendants of any dragged group. Edges touching one of these light up
   * while the gesture runs.
   */
  dragAffectedNodeIds: ReadonlySet<string>;
  setDraggingNode: (dragging: boolean) => void;
  setDraggingNodeIds: (nodeIds: string[]) => void;
  setDragAffectedNodeIds: (nodeIds: ReadonlySet<string>) => void;
};

const EMPTY_IDS: string[] = [];
const EMPTY_SET: ReadonlySet<string> = new Set();

/**
 * Pointer-gesture flags live in their own store.
 *
 * They flip at drag start/stop and are read by the label layer and the panels;
 * keeping them in editor state re-rendered the whole editor (and every child
 * that received `draggingNode`) twice per gesture. Ported from the tu_api
 * canvas interaction store.
 */
export const useCanvasInteractionStore = create<CanvasInteractionState>(
  (set, get) => ({
    draggingNode: false,
    draggingNodeIds: EMPTY_IDS,
    dragAffectedNodeIds: EMPTY_SET,
    setDraggingNode: (draggingNode) => {
      if (get().draggingNode === draggingNode) {
        return;
      }
      set(
        draggingNode
          ? { draggingNode }
          : {
              draggingNode: false,
              draggingNodeIds: EMPTY_IDS,
              dragAffectedNodeIds: EMPTY_SET,
            },
      );
    },
    setDraggingNodeIds: (draggingNodeIds) => {
      const current = get().draggingNodeIds;
      if (
        current.length === draggingNodeIds.length &&
        current.every((id, index) => id === draggingNodeIds[index])
      ) {
        return;
      }
      set({ draggingNodeIds });
    },
    setDragAffectedNodeIds: (next) => {
      const current = get().dragAffectedNodeIds;
      if (current === next) {
        return;
      }
      if (
        current.size === next.size &&
        [...next].every((id) => current.has(id))
      ) {
        return;
      }
      set({ dragAffectedNodeIds: next });
    },
  }),
);
