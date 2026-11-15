"use client";

import { create } from "zustand";

import { getSelection } from "./canvas-derived";
import type { CanvasFlowNode } from "./canvas-store";

/**
 * Selected node ids, published for the edges.
 *
 * Edges need to know whether either endpoint is selected (to light up), but
 * subscribing each of ~200 edges to `state.nodes` would run a selector on every
 * graph write. The surface computes this once per nodes-array change and edges
 * subscribe to a stable `ReadonlySet` instead.
 */
type CanvasEdgeHighlightState = {
  selectedIds: ReadonlySet<string>;
  setSelectedIds: (set: ReadonlySet<string>) => void;
};

const EMPTY: ReadonlySet<string> = new Set();

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a === b) {
    return true;
  }
  if (a.size !== b.size) {
    return false;
  }
  for (const id of a) {
    if (!b.has(id)) {
      return false;
    }
  }
  return true;
}

export const useCanvasEdgeHighlightStore = create<CanvasEdgeHighlightState>(
  (set, get) => ({
    selectedIds: EMPTY,
    setSelectedIds: (next) => {
      if (sameSet(get().selectedIds, next)) {
        return;
      }
      set({ selectedIds: next });
    },
  }),
);

/** Publish the current selection for the edge layer (call from a store subscription). */
export function syncCanvasEdgeSelection(nodes: readonly CanvasFlowNode[]): void {
  const ids = getSelection(nodes).ids;
  useCanvasEdgeHighlightStore
    .getState()
    .setSelectedIds(ids.length === 0 ? EMPTY : new Set(ids));
}
