"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@xyflow/react";

import { useCanvasStore } from "@/lib/canvas/canvas-store";
import { useCanvasViewportPerfStore } from "@/lib/canvas/canvas-viewport-perf-store";

/**
 * Viewport-derived state. Panning fires on every frame, so the only work done
 * here is a ref update plus a debounced visible-id scan that lands in a store
 * (never in editor state). The level-of-detail switch is handled by CSS
 * classes in the graph surface, so nothing re-renders while the viewport moves.
 */
export function useCanvasViewport() {
  const flowWidth = useStore((state) => state.width);
  const flowHeight = useStore((state) => state.height);
  // The raw zoom lives in a ref: a zoom gesture fires on every tick, and
  // storing it as state re-rendered the editor per tick.
  const zoomRef = useRef(1);
  const [viewportLocked, setViewportLocked] = useState(false);
  const visibleTimerRef = useRef<number | null>(null);

  const syncViewport = useCallback(
    (viewport: { x: number; y: number; zoom: number }) => {
      const zoom = viewport.zoom || 1;
      zoomRef.current = zoom;
      // Debounced, not throttled: the visible-id scan runs once the gesture
      // has settled, and lands in the viewport perf store instead of editor
      // state so panning never re-renders the editor tree.
      if (visibleTimerRef.current !== null) {
        window.clearTimeout(visibleTimerRef.current);
      }
      visibleTimerRef.current = window.setTimeout(() => {
        visibleTimerRef.current = null;
        useCanvasViewportPerfStore.getState().sync({
          viewport,
          nodes: useCanvasStore.getState().nodes,
          width: flowWidth || 1200,
          height: flowHeight || 800,
        });
      }, 220);
    },
    [flowHeight, flowWidth],
  );

  useEffect(
    () => () => {
      if (visibleTimerRef.current !== null) {
        window.clearTimeout(visibleTimerRef.current);
      }
    },
    [],
  );

  return {
    zoomRef,
    syncViewport,
    viewportLocked,
    setViewportLocked,
  };
}
