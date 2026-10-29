"use client";

import { NodeToolbar, Position } from "@xyflow/react";
import type { CanvasNodeType } from "@/lib/tu-shared-browser";
import { useCanvasStore } from "@/lib/canvas/canvas-store";
import { CanvasNodeHeaderActions } from "./canvas-node-header-actions";

/**
 * Unselected nodes must not mount a NodeToolbar: React Flow keeps one
 * subscription per toolbar, which becomes expensive on large canvases.
 */
export function CanvasNodeToolbar({
  nodeId,
  type,
  selected,
}: {
  nodeId: string;
  type: CanvasNodeType;
  selected: boolean;
}) {
  if (!selected) {
    return null;
  }
  return <SelectedCanvasNodeToolbar nodeId={nodeId} type={type} />;
}

function SelectedCanvasNodeToolbar({
  nodeId,
  type,
}: {
  nodeId: string;
  type: CanvasNodeType;
}) {
  const mediaType = type === "text" || type === "group" ? undefined : type;
  const multipleSelected = useCanvasStore(
    (state) => state.nodes.filter((node) => node.selected).length > 1,
  );

  return (
    <NodeToolbar
      isVisible={!multipleSelected}
      position={Position.Top}
      align="center"
      offset={34}
    >
      <div className="nodrag nopan flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-white/95 p-1 shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
        <CanvasNodeHeaderActions nodeId={nodeId} mediaType={mediaType} />
      </div>
    </NodeToolbar>
  );
}
