"use client";

import { CanvasNodeDockLayer } from "@/components/canvas/canvas-node-dock-layer";
import { CanvasImageGenerationDock } from "@/components/canvas/canvas-image-generation-dock";
import { CanvasTextGenerationDock } from "@/components/canvas/canvas-text-generation-dock";
import { CanvasVideoGenerationDock } from "@/components/canvas/canvas-video-generation-dock";
import type { CanvasFlowNode } from "@/lib/canvas/canvas-store";

/**
 * Generation dock that floats next to a node. The editor decides which node
 * is docked (selection or "open settings" on a node); this only picks the dock
 * that matches the node type.
 */
export function CanvasNodeDockSlot({
  nodeDock,
  onClose,
}: {
  nodeDock: CanvasFlowNode | null;
  onClose: () => void;
}) {
  if (!nodeDock) {
    return null;
  }
  return (
    <CanvasNodeDockLayer key={nodeDock.id} node={nodeDock}>
      {nodeDock.type === "image" ? (
        <CanvasImageGenerationDock
          key={nodeDock.id}
          nodeId={nodeDock.id}
          onClose={onClose}
          embedded
        />
      ) : nodeDock.type === "video" ? (
        <CanvasVideoGenerationDock
          key={nodeDock.id}
          nodeId={nodeDock.id}
          onClose={onClose}
          embedded
        />
      ) : (
        <CanvasTextGenerationDock
          key={nodeDock.id}
          nodeId={nodeDock.id}
          onClose={onClose}
          embedded
        />
      )}
    </CanvasNodeDockLayer>
  );
}
