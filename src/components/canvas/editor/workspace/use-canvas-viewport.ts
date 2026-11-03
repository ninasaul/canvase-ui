"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useStore } from "@xyflow/react";

import { useCanvasStore } from "@/lib/canvas/canvas-store";

import {
  CANVAS_EDGE_LABEL_ZOOM,
  CANVAS_LOD_ZOOM,
} from "../lib/constants";

/**
 * Viewport-derived state. Panning fires on every frame, so values are only
 * refreshed when a gesture ends: the zoom tier (level of detail) and the ids
 * inside the viewport (used as agent context).
 */
export function useCanvasViewport() {
  const flowWidth = useStore((state) => state.width);
  const flowHeight = useStore((state) => state.height);
  // The raw zoom lives in a ref: a zoom gesture fires on every tick, and
  // storing it as state re-rendered the editor (and every node) per tick.
  // Only the derived tiers are state, so a render happens when the level of
  // detail actually changes.
  const zoomRef = useRef(1);
  const [tier, setTier] = useState({
    far: 1 < CANVAS_LOD_ZOOM,
    showEdgeLabels: 1 >= CANVAS_EDGE_LABEL_ZOOM,
  });
  const [visibleNodeIds, setVisibleNodeIds] = useState<string[]>([]);
  const [viewportLocked, setViewportLocked] = useState(false);
  const lastVisibleAtRef = useRef(0);

  const canvasDetail = useMemo(
    () => ({ far: tier.far, showEdgeLabels: tier.showEdgeLabels }),
    [tier.far, tier.showEdgeLabels],
  );

  const syncViewport = useCallback(
    (viewport: { x: number; y: number; zoom: number }) => {
      const zoom = viewport.zoom || 1;
      zoomRef.current = zoom;
      const far = zoom < CANVAS_LOD_ZOOM;
      const showEdgeLabels = zoom >= CANVAS_EDGE_LABEL_ZOOM;
      setTier((previous) =>
        previous.far === far && previous.showEdgeLabels === showEdgeLabels
          ? previous
          : { far, showEdgeLabels },
      );
      const width = (flowWidth || 1200) / zoom;
      const height = (flowHeight || 800) / zoom;
      const left = -viewport.x / zoom;
      const top = -viewport.y / zoom;
      const now = Date.now();
      if (Date.now() - lastVisibleAtRef.current < 120) {
        return;
      }
      lastVisibleAtRef.current = now;
      const store = useCanvasStore.getState();
      const nextIds = store.nodes
        .filter((node) => {
          const nodeWidth = node.width ?? 240;
          const nodeHeight = node.height ?? 240;
          return (
            node.position.x + nodeWidth >= left &&
            node.position.x <= left + width &&
            node.position.y + nodeHeight >= top &&
            node.position.y <= top + height
          );
        })
        .slice(0, 40)
        .map((node) => node.id);
      // Keep the previous array when the set is unchanged: a new identity
      // here re-rendered every consumer (chat context → chat panel) on each
      // pan, even when the same nodes stayed visible.
      setVisibleNodeIds((previous) =>
        previous.length === nextIds.length &&
        previous.every((id, index) => id === nextIds[index])
          ? previous
          : nextIds,
      );
    },
    [flowHeight, flowWidth],
  );

  return {
    zoomRef,
    visibleNodeIds,
    canvasDetail,
    syncViewport,
    viewportLocked,
    setViewportLocked,
  };
}
