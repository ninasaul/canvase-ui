"use client";

import { useStoreWithEqualityFn } from "zustand/traditional";
import { useCanvasStore } from "./canvas-store";
import { collectCanvasUpstreamPrompt } from "./canvas-upstream-media";

/**
 * Connected prompt/context text that generation will consume.
 *
 * Derived in the selector (edge-first, no full text-node map) and compared with
 * `Object.is`: typing in an unrelated node no longer re-renders every dock.
 */
export function useCanvasUpstreamPrompt(nodeId: string): string {
  return useStoreWithEqualityFn(
    useCanvasStore,
    (state) => collectCanvasUpstreamPrompt(state.nodes, state.edges, nodeId),
    Object.is,
  );
}
