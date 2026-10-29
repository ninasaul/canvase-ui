"use client";

import { ViewportPortal } from "@xyflow/react";

import type { CanvasHelperLines } from "@/lib/canvas/canvas-helper-lines";

const LINE_EXTENT = 10_000;

type CanvasHelperLinesOverlayProps = {
  lines: CanvasHelperLines | null;
};

export function CanvasHelperLinesOverlay({
  lines,
}: CanvasHelperLinesOverlayProps) {
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
