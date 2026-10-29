"use client";

import { NodeResizer } from "@xyflow/react";
import { useCanvasPreferences } from "./canvas-preferences-context";
import { useCanvasStore } from "@/lib/canvas/canvas-store";

/**
 * Only mount NodeResizer for the selected node. Keeping an invisible resizer
 * on every node adds unnecessary React Flow subscriptions.
 */
export function CanvasNodeResizer({
  nodeId,
  selected,
  minWidth,
  minHeight,
  keepAspectRatio = true,
}: {
  nodeId: string;
  selected: boolean;
  minWidth: number;
  minHeight: number;
  keepAspectRatio?: boolean;
}) {
  const enabled = useCanvasPreferences().nodeResizeEnabled;
  if (!selected || !enabled) {
    return null;
  }
  return (
    <ActiveCanvasNodeResizer
      nodeId={nodeId}
      minWidth={minWidth}
      minHeight={minHeight}
      keepAspectRatio={keepAspectRatio}
    />
  );
}

function ActiveCanvasNodeResizer({
  nodeId,
  minWidth,
  minHeight,
  keepAspectRatio,
}: {
  nodeId: string;
  minWidth: number;
  minHeight: number;
  keepAspectRatio: boolean;
}) {
  const setNodeSize = useCanvasStore((state) => state.setNodeSize);

  return (
    <NodeResizer
      nodeId={nodeId}
      isVisible
      keepAspectRatio={keepAspectRatio}
      minWidth={minWidth}
      minHeight={minHeight}
      color="#38bdf8"
      handleClassName="canvas-resize-handle !h-2.5 !w-2.5 !rounded-full !border-2 !border-white dark:!border-zinc-900"
      lineClassName="!border-0"
      onResize={(_event, params) => {
        setNodeSize(nodeId, params.width, params.height);
      }}
    />
  );
}
