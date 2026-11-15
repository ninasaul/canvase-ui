"use client";

import { memo } from "react";

import { CanvasNodeDockLayer } from "@/components/canvas/canvas-node-dock-layer";
import { CanvasImageGenerationDock } from "@/components/canvas/canvas-image-generation-dock";
import { CanvasTextGenerationDock } from "@/components/canvas/canvas-text-generation-dock";
import { CanvasVideoGenerationDock } from "@/components/canvas/canvas-video-generation-dock";
import type { CanvasNodeType } from "@/lib/tu-shared-browser";
import { useCanvasStore } from "@/lib/canvas/canvas-store";
import { getNodeById } from "@/lib/canvas/canvas-node-index";

/**
 * Generation dock that floats next to a node. The editor passes only the node
 * id: the type is resolved here, so editing that node (which replaces its
 * object on every keystroke) no longer re-renders the editor itself.
 */
export const CanvasNodeDockSlot = memo(function CanvasNodeDockSlot({
  nodeId,
  onClose,
}: {
  nodeId: string | null;
  onClose: () => void;
}) {
  const nodeType = useCanvasStore((state): CanvasNodeType | undefined =>
    nodeId ? getNodeById(state.nodes, nodeId)?.type : undefined,
  );
  if (!nodeId || !nodeType) {
    return null;
  }
  return (
    <CanvasNodeDockLayer key={nodeId} nodeId={nodeId}>
      {nodeType === "image" ? (
        <CanvasImageGenerationDock
          key={nodeId}
          nodeId={nodeId}
          onClose={onClose}
          embedded
        />
      ) : nodeType === "video" ? (
        <CanvasVideoGenerationDock
          key={nodeId}
          nodeId={nodeId}
          onClose={onClose}
          embedded
        />
      ) : (
        <CanvasTextGenerationDock
          key={nodeId}
          nodeId={nodeId}
          onClose={onClose}
          embedded
        />
      )}
    </CanvasNodeDockLayer>
  );
});
