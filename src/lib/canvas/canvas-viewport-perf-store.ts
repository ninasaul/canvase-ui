"use client";

import { create } from "zustand";
import {
  collectVisibleCanvasNodeIds,
  sameStringSet,
  type CanvasViewportSnapshot,
} from "./canvas-viewport-perf";
import type { CanvasFlowNode } from "./canvas-store";

type CanvasViewportPerfState = {
  viewport: CanvasViewportSnapshot;
  visibleNodeIds: ReadonlySet<string>;
  sync: (input: {
    viewport: CanvasViewportSnapshot;
    nodes: readonly CanvasFlowNode[];
    width: number;
    height: number;
  }) => void;
};

const EMPTY_IDS: ReadonlySet<string> = new Set();

/**
 * Viewport-derived data kept out of editor state.
 *
 * Panning fires on every frame and the visible-id set changes as the pane
 * moves; as editor state that re-rendered the whole editor and its chat
 * context. Consumers subscribe to the slice they need instead. Ported from the
 * tu_api canvas viewport perf store.
 */
export const useCanvasViewportPerfStore = create<CanvasViewportPerfState>(
  (set, get) => ({
    viewport: { x: 0, y: 0, zoom: 1 },
    visibleNodeIds: EMPTY_IDS,
    sync: ({ viewport, nodes, width, height }) => {
      const visible = collectVisibleCanvasNodeIds(
        nodes,
        viewport,
        width,
        height,
      );
      const current = get();
      const sameVisibility = sameStringSet(current.visibleNodeIds, visible);
      if (
        current.viewport.x === viewport.x &&
        current.viewport.y === viewport.y &&
        current.viewport.zoom === viewport.zoom &&
        sameVisibility
      ) {
        return;
      }
      set({
        viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
        // Only replace the Set when the visible node set actually changed.
        // Zoom-only updates must not invalidate every label subscriber.
        visibleNodeIds: sameVisibility
          ? current.visibleNodeIds
          : new Set(visible),
      });
    },
  }),
);
