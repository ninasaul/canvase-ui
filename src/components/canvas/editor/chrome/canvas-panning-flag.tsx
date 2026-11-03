"use client";

import { useEffect, type RefObject } from "react";
import { useStoreApi } from "@xyflow/react";

import { useViewportMotionStore } from "@/lib/canvas/viewport-motion-store";

/**
 * Marks the canvas surface with `data-panning` / `data-zooming` while the
 * viewport is moving.
 *
 * Both flags are written imperatively from the xyflow store subscription and
 * cleared on a short idle timer, so no React component re-renders at all — a
 * pan or a zoom gesture used to re-render the editor (and its children) just
 * to flip a data attribute.
 */
export function CanvasPanningFlag({
  surfaceRef,
}: {
  surfaceRef: RefObject<HTMLDivElement | null>;
}) {
  const store = useStoreApi();

  useEffect(() => {
    const element = surfaceRef.current;
    if (!element) {
      return;
    }
    let panning = false;
    let lastZoom = store.getState().transform[2];
    let motion = false;
    let idleTimer: number | null = null;
    let zoomTimer: number | null = null;

    const markMotion = () => {
      const { setMoving } = useViewportMotionStore.getState();
      if (!motion) {
        motion = true;
        setMoving(true);
      }
      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
      }
      idleTimer = window.setTimeout(() => {
        idleTimer = null;
        if (!useViewportMotionStore.getState().moving) {
          return;
        }
        motion = false;
        useViewportMotionStore.getState().setMoving(false);
      }, 180);
    };

    const unsubscribe = store.subscribe((state) => {
      const nextPanning = state.paneDragging;
      if (nextPanning) {
        markMotion();
      }
      if (nextPanning !== panning) {
        panning = nextPanning;
        if (panning) {
          element.dataset.panning = "true";
        } else {
          delete element.dataset.panning;
        }
      }

      const zoom = state.transform[2];
      if (zoom !== lastZoom) {
        lastZoom = zoom;
        markMotion();
        element.dataset.zooming = "true";
        if (zoomTimer !== null) {
          window.clearTimeout(zoomTimer);
        }
        zoomTimer = window.setTimeout(() => {
          zoomTimer = null;
          delete element.dataset.zooming;
        }, 180);
      }
    });

    return () => {
      unsubscribe();
      if (zoomTimer !== null) {
        window.clearTimeout(zoomTimer);
      }
      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
      }
      useViewportMotionStore.getState().setMoving(false);
      delete element.dataset.panning;
      delete element.dataset.zooming;
    };
  }, [store, surfaceRef]);

  return null;
}
