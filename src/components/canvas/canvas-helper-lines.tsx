"use client";

import { ViewportPortal } from "@xyflow/react";

import { useCanvasHelperLinesStore } from "@/lib/canvas/canvas-helper-lines-store";

const LINE_EXTENT = 10_000;

/**
 * Subscribes to the guide store itself: the guides move every drag frame, and
 * routing them through editor state re-rendered the entire editor tree.
 */
export function CanvasHelperLinesOverlay() {
  const lines = useCanvasHelperLinesStore((state) => state.lines);
  if (!lines || (lines.horizontal == null && lines.vertical == null)) {
    return null;
  }

  return (
    <ViewportPortal>
      <div className="pointer-events-none absolute inset-0 overflow-visible">
        {lines.vertical != null ? (
          <div
            aria-hidden
            className="absolute w-px bg-sky-500/70 dark:bg-sky-400/70"
            style={{
              left: lines.vertical,
              top: -LINE_EXTENT,
              height: LINE_EXTENT * 2,
            }}
          />
        ) : null}
        {lines.horizontal != null ? (
          <div
            aria-hidden
            className="absolute h-px bg-sky-500/70 dark:bg-sky-400/70"
            style={{
              top: lines.horizontal,
              left: -LINE_EXTENT,
              width: LINE_EXTENT * 2,
            }}
          />
        ) : null}
      </div>
    </ViewportPortal>
  );
}
