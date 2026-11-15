"use client";

import { create } from "zustand";

/**
 * Which edge the pointer is over. Kept in its own store so hovering one edge
 * re-renders that edge (and anything that highlights the connected nodes) and
 * nothing else — the graph, the labels and the chrome never see the change.
 *
 * Ported from the reference canvas.
 */
type CanvasEdgeHoverState = {
  hoveredEdgeId: string | null;
  sourceId: string | null;
  targetId: string | null;
  setHoveredEdge: (input: {
    edgeId: string;
    sourceId: string;
    targetId: string;
  }) => void;
  clearHoveredEdge: (edgeId?: string) => void;
};

export const useCanvasEdgeHoverStore = create<CanvasEdgeHoverState>(
  (set, get) => ({
    hoveredEdgeId: null,
    sourceId: null,
    targetId: null,
    setHoveredEdge: ({ edgeId, sourceId, targetId }) => {
      const current = get();
      if (
        current.hoveredEdgeId === edgeId &&
        current.sourceId === sourceId &&
        current.targetId === targetId
      ) {
        return;
      }
      set({ hoveredEdgeId: edgeId, sourceId, targetId });
    },
    clearHoveredEdge: (edgeId) => {
      if (edgeId && get().hoveredEdgeId !== edgeId) {
        return;
      }
      set({ hoveredEdgeId: null, sourceId: null, targetId: null });
    },
  }),
);

/** True when the node is an endpoint of the hovered edge. */
export function selectNodeEdgeHoverHighlighted(nodeId: string) {
  return (state: CanvasEdgeHoverState) =>
    state.sourceId === nodeId || state.targetId === nodeId;
}
