"use client";

import { useViewport } from "@xyflow/react";
import type { ReactNode } from "react";
import { CANVAS_GENERATION_FLOAT_SURFACE_CLASS } from "@/components/playground/playground-styles";
import { useCanvasStore, type CanvasFlowNode } from "@/lib/canvas/canvas-store";
import { canvasNodeAbsolutePosition } from "@/lib/canvas/canvas-node-position";

export function CanvasNodeDockLayer({
  node,
  children,
}: {
  node: CanvasFlowNode;
  children: ReactNode;
}) {
  const nodes = useCanvasStore((state) => state.nodes);
  const { x, y, zoom } = useViewport();
  const position = canvasNodeAbsolutePosition(
    node,
    new Map(nodes.map((item) => [item.id, item])),
  );
  const width = node.width ?? node.measured?.width ?? 280;
  const height = node.height ?? node.measured?.height ?? 200;
  return (
    <div
      className={`canvas-node-dock nodrag absolute z-40 max-h-[55vh] w-[min(760px,calc(100vw-2rem))] overflow-y-auto p-3 ${CANVAS_GENERATION_FLOAT_SURFACE_CLASS}`}
      style={{
        left: Math.max(8, x + position.x * zoom + (width * zoom - 760) / 2),
        top: y + (position.y + height) * zoom + 12,
        width: 760,
      }}
    >
      {children}
    </div>
  );
}
