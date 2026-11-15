"use client";

import { memo } from "react";

import { CanvasImageGenerationDock } from "@/components/canvas/canvas-image-generation-dock";
import { CanvasTextGenerationDock } from "@/components/canvas/canvas-text-generation-dock";
import { CanvasVideoGenerationDock } from "@/components/canvas/canvas-video-generation-dock";
import type { CanvasPreferences } from "@/lib/canvas/canvas-preferences";
import { useCanvasStore } from "@/lib/canvas/canvas-store";
import { getNodeById } from "@/lib/canvas/canvas-node-index";

/**
 * Docked generation panel when the placement preference is "canvas": it pins
 * to the side of the canvas instead of floating next to the node.
 *
 * Only the node id comes from the editor; the type is resolved from the store
 * so prompt keystrokes inside the dock never re-render the editor tree.
 */
export const CanvasGenerationDock = memo(function CanvasGenerationDock({
  nodeId,
  preferences,
  onClose,
}: {
  nodeId: string | null;
  preferences: CanvasPreferences;
  onClose: () => void;
}) {
  const nodeType = useCanvasStore((state) =>
    nodeId ? getNodeById(state.nodes, nodeId)?.type : undefined,
  );
  if (preferences.generationDockPlacement !== "canvas" || !nodeId || !nodeType) {
    return null;
  }
  if (nodeType === "image") {
    return (
      <CanvasImageGenerationDock
        key={nodeId}
        nodeId={nodeId}
        onClose={onClose}
      />
    );
  }
  if (nodeType === "video") {
    return (
      <CanvasVideoGenerationDock
        key={nodeId}
        nodeId={nodeId}
        onClose={onClose}
      />
    );
  }
  if (nodeType === "text") {
    return (
      <CanvasTextGenerationDock
        key={nodeId}
        nodeId={nodeId}
        onClose={onClose}
      />
    );
  }
  return null;
});
