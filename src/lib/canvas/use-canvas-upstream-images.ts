"use client";

import { useStoreWithEqualityFn } from "zustand/traditional";
import { useCanvasStore } from "./canvas-store";
import {
  canvasUpstreamImagesEqual,
  collectCanvasUpstreamImages,
  type CanvasUpstreamImage,
} from "./canvas-upstream-media";

export type { CanvasUpstreamImage };

/**
 * Images connected to a generation node.
 *
 * The list is derived inside the selector and compared by value, so a node
 * edit that does not touch connected media (prompt keystrokes, status ticks)
 * leaves the dock untouched. Ported from the tu_api canvas upstream hooks.
 */
export function useCanvasUpstreamImages(nodeId: string): CanvasUpstreamImage[] {
  return useStoreWithEqualityFn(
    useCanvasStore,
    (state) => collectCanvasUpstreamImages(state.nodes, state.edges, nodeId),
    canvasUpstreamImagesEqual,
  );
}
