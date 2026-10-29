"use client";

import { useViewport } from "@xyflow/react";

export function CanvasZoomLabel() {
  const { zoom } = useViewport();
  return (
    <span className="min-w-9 text-center text-[10px] tabular-nums text-zinc-500">
      {Math.round(zoom * 100)}%
    </span>
  );
}
