"use client";

import { useCallback, useMemo, useState } from "react";
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
  const [viewportZoom, setViewportZoom] = useState(1);
  const [visibleNodeIds, setVisibleNodeIds] = useState<string[]>([]);
  const [viewportLocked, setViewportLocked] = useState(false);

  const canvasDetail = useMemo(
    () => ({
      far: viewportZoom < CANVAS_LOD_ZOOM,
      showEdgeLabels: viewportZoom >= CANVAS_EDGE_LABEL_ZOOM,
    }),
    [viewportZoom],
  );

  const syncViewport = useCallback(
    (viewport: { x: number; y: number; zoom: number }) => {
      setViewportZoom(viewport.zoom || 1);
      const zoom = viewport.zoom || 1;
      const width = (flowWidth || 1200) / zoom;
      const height = (flowHeight || 800) / zoom;
      const left = -viewport.x / zoom;
      const top = -viewport.y / zoom;
      const store = useCanvasStore.getState();
      setVisibleNodeIds(
        store.nodes
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
          .map((node) => node.id),
      );
    },
    [flowHeight, flowWidth],
  );

  return {
    viewportZoom,
    visibleNodeIds,
    canvasDetail,
    syncViewport,
    viewportLocked,
    setViewportLocked,
  };
}
