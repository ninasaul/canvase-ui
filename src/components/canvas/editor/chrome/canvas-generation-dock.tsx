"use client";

import { CanvasImageGenerationDock } from "@/components/canvas/canvas-image-generation-dock";
import { CanvasTextGenerationDock } from "@/components/canvas/canvas-text-generation-dock";
import { CanvasVideoGenerationDock } from "@/components/canvas/canvas-video-generation-dock";
import type { CanvasPreferences } from "@/lib/canvas/canvas-preferences";
import type { CanvasFlowNode } from "@/lib/canvas/canvas-store";

/**
 * Docked generation panel when the placement preference is "canvas": it pins
 * to the side of the canvas instead of floating next to the node.
 */
export function CanvasGenerationDock({
  configNode,
  preferences,
  onClose,
}: {
  configNode: CanvasFlowNode | null;
  preferences: CanvasPreferences;
  onClose: () => void;
}) {
  if (preferences.generationDockPlacement !== "canvas" || !configNode) {
    return null;
  }
  if (configNode.type === "image") {
    return (
      <CanvasImageGenerationDock
        key={configNode.id}
        nodeId={configNode.id}
        onClose={onClose}
      />
    );
  }
  if (configNode.type === "video") {
    return (
      <CanvasVideoGenerationDock
        key={configNode.id}
        nodeId={configNode.id}
        onClose={onClose}
      />
    );
  }
  if (configNode.type === "text") {
    return (
      <CanvasTextGenerationDock
        key={configNode.id}
        nodeId={configNode.id}
        onClose={onClose}
      />
    );
  }
  return null;
}
