"use client";

import {
  Background,
  BackgroundVariant,
  MiniMap,
  type Node,
} from "@xyflow/react";

import type { CanvasPreferences } from "@/lib/canvas/canvas-preferences";
import { NODE_TYPE_COLORS } from "../lib/constants";

/**
 * Canvas backdrop: the dot/line pattern and the minimap. Both follow the
 * appearance preferences, and the minimap is skipped on large canvases while a
 * node is being dragged (it re-renders every frame otherwise).
 */
export function CanvasBackdrop({
  preferences,
  patternSize,
  patternColor,
  nodeCount,
  draggingNode,
}: {
  preferences: CanvasPreferences;
  patternSize: number;
  patternColor: string;
  nodeCount: number;
  draggingNode: boolean;
}) {
  return (
    <>
      {preferences.background !== "none" ? (
        <Background
          variant={
            preferences.background === "lines"
              ? BackgroundVariant.Lines
              : preferences.background === "cross"
                ? BackgroundVariant.Cross
                : BackgroundVariant.Dots
          }
          gap={preferences.backgroundGap}
          size={patternSize}
          color={patternColor}
        />
      ) : null}
      {preferences.showMiniMap && nodeCount <= 150 && !draggingNode ? (
        <MiniMap
          className="canvas-minimap"
          pannable
          zoomable
          nodeColor={(node: Node) =>
            NODE_TYPE_COLORS[node.type ?? "text"] ?? "#a1a1aa"
          }
        />
      ) : null}
    </>
  );
}
