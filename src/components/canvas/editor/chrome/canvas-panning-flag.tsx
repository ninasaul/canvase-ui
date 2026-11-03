"use client";

import { useEffect, type RefObject } from "react";
import { useStore } from "@xyflow/react";

/**
 * Marks the canvas surface with `data-panning` while the pane moves.
 *
 * Uses an effect instead of editor state on purpose: panning fires twice per
 * gesture, and re-rendering the editor just to flip an attribute re-rendered
 * every child (toolbar, overlays, docks) for no visual gain.
 */
export function CanvasPanningFlag({
  surfaceRef,
}: {
  surfaceRef: RefObject<HTMLDivElement | null>;
}) {
  const paneDragging = useStore((state) => state.paneDragging);

  useEffect(() => {
    const element = surfaceRef.current;
    if (!element) {
      return;
    }
    if (paneDragging) {
      element.dataset.panning = "true";
    } else {
      delete element.dataset.panning;
    }
  }, [paneDragging, surfaceRef]);

  return null;
}
