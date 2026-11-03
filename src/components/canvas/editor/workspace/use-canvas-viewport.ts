"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@xyflow/react";

import { useCanvasStore } from "@/lib/canvas/canvas-store";

import {
  CANVAS_EDGE_LABEL_ZOOM,
  CANVAS_LOD_ENABLED,
  CANVAS_LOD_ZOOM,
} from "../lib/constants";

/**
 * Hysteresis around the level-of-detail switch: a gesture that hovers exactly
 * on the threshold would otherwise flip the tier (and re-render every node)
 * back and forth on consecutive wheel ticks.
 */
const LOD_ENTER = CANVAS_LOD_ZOOM; // zoom below this → simplified nodes
const LOD_EXIT = CANVAS_LOD_ZOOM + 0.06; // zoom above this → full nodes
const LABELS_ENTER = CANVAS_EDGE_LABEL_ZOOM;
const LABELS_EXIT = CANVAS_EDGE_LABEL_ZOOM - 0.06;

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
  // The tier is applied on idle, not mid-gesture: switching LOD back to full
  // nodes re-renders every node (textareas, images, players) in one pass, and
  // doing that while the user is still scrolling made the zoom feel frozen.
  const pendingTierRef = useRef<{ far: boolean; showEdgeLabels: boolean } | null>(
    null,
  );
  const tierTimerRef = useRef<number | null>(null);
  const [tier, setTier] = useState({
    far: 1 < CANVAS_LOD_ZOOM,
    showEdgeLabels: 1 >= CANVAS_EDGE_LABEL_ZOOM,
  });
  const [visibleNodeIds, setVisibleNodeIds] = useState<string[]>([]);
  const [viewportLocked, setViewportLocked] = useState(false);
  const visibleTimerRef = useRef<number | null>(null);

  const canvasDetail = useMemo(
    () => ({ far: tier.far, showEdgeLabels: tier.showEdgeLabels }),
    [tier.far, tier.showEdgeLabels],
  );

  const syncViewport = useCallback(
    (viewport: { x: number; y: number; zoom: number }) => {
      const zoom = viewport.zoom || 1;
      zoomRef.current = zoom;
      setTier((previous) => {
        const far = CANVAS_LOD_ENABLED
          ? previous.far
            ? zoom < LOD_EXIT
            : zoom < LOD_ENTER
          : false;
        const showEdgeLabels = previous.showEdgeLabels
          ? zoom >= LABELS_EXIT
          : zoom >= LABELS_ENTER;
        if (
          previous.far === far &&
          previous.showEdgeLabels === showEdgeLabels
        ) {
          return previous;
        }
        pendingTierRef.current = { far, showEdgeLabels };
        if (tierTimerRef.current !== null) {
          window.clearTimeout(tierTimerRef.current);
        }
        tierTimerRef.current = window.setTimeout(() => {
          tierTimerRef.current = null;
          const next = pendingTierRef.current;
          pendingTierRef.current = null;
          if (next) {
            setTier(next);
          }
        }, 160);
        return previous;
      });
      const width = (flowWidth || 1200) / zoom;
      const height = (flowHeight || 800) / zoom;
      const left = -viewport.x / zoom;
      const top = -viewport.y / zoom;
      // Debounced, not throttled: while the pane moves nothing here may set
      // React state, otherwise every 120ms the editor (and the chat panel via
      // its context) re-rendered for a viewport nobody is reading yet. The
      // scan runs once the gesture has settled.
      if (visibleTimerRef.current !== null) {
        window.clearTimeout(visibleTimerRef.current);
      }
      visibleTimerRef.current = window.setTimeout(() => {
        visibleTimerRef.current = null;
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
        // here re-renders every consumer of the viewport snapshot.
        setVisibleNodeIds((previous) =>
          previous.length === nextIds.length &&
          previous.every((id, index) => id === nextIds[index])
            ? previous
            : nextIds,
        );
      }, 220);
    },
    [flowHeight, flowWidth],
  );

  useEffect(
    () => () => {
      if (tierTimerRef.current !== null) {
        window.clearTimeout(tierTimerRef.current);
      }
      if (visibleTimerRef.current !== null) {
        window.clearTimeout(visibleTimerRef.current);
      }
    },
    [],
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
