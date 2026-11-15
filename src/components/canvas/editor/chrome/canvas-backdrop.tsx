"use client";

import { memo } from "react";

import type { CanvasPreferences } from "@/lib/canvas/canvas-preferences";
import { useCanvasStore } from "@/lib/canvas/canvas-store";
import { useCanvasInteractionStore } from "@/lib/canvas/canvas-interaction-store";
import { CanvasBackgroundLayer } from "./canvas-background-layer";
import { CanvasMinimap } from "./canvas-minimap";

/**
 * Canvas backdrop: the dot/line pattern and the minimap.
 *
 * Both are rendered by our own components (see their docs): the xyflow
 * equivalents re-render in React on every viewport frame, which made a pan over
 * a 120-node canvas commit once per frame.
 */
function CanvasBackdropInner({
  preferences,
  patternSize,
  patternColor,
}: {
  preferences: CanvasPreferences;
  patternSize: number;
  patternColor: string;
}) {
  // The minimap threshold only needs the count, so subscribe to the number and
  // stop the editor from carrying a node subscription for this alone.
  const nodeCount = useCanvasStore((state) => state.nodes.length);
  // Drag flags come from the interaction store: as editor state they forced a
  // full editor render at every drag start/stop.
  const draggingNode = useCanvasInteractionStore((state) => state.draggingNode);
  return (
    <>
      {preferences.background !== "none" ? (
        <CanvasBackgroundLayer
          kind={preferences.background}
          gap={preferences.backgroundGap}
          size={patternSize}
          color={patternColor}
        />
      ) : null}
      {preferences.showMiniMap && nodeCount <= 150 && !draggingNode ? (
        <CanvasMinimap />
      ) : null}
    </>
  );
}

export const CanvasBackdrop = memo(CanvasBackdropInner);
