"use client";

import {
  ConnectionLineType,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type ConnectionLineComponentProps,
} from "@xyflow/react";

import type { CanvasFlowNode } from "@/lib/canvas/canvas-store";

const CONNECTING_STROKE = "#0ea5e9";

/**
 * Temporary line while dragging from a handle, before a target is connected.
 *
 * Ported from the reference canvas: the line keeps the preference stroke width,
 * turns red when the hovered target is invalid, green when it is valid, and
 * otherwise draws a flowing sky dash — so the drag always says what will
 * happen. `vector-effect` keeps it a constant screen width at any zoom.
 */
export function CanvasConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  connectionLineType,
  connectionLineStyle,
  connectionStatus,
}: ConnectionLineComponentProps<CanvasFlowNode>) {
  const pathParams = {
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  };
  const [path] =
    connectionLineType === ConnectionLineType.Bezier
      ? getBezierPath(pathParams)
      : connectionLineType === ConnectionLineType.Straight
        ? getStraightPath(pathParams)
        : getSmoothStepPath(pathParams);

  const strokeWidth =
    typeof connectionLineStyle?.strokeWidth === "number"
      ? connectionLineStyle.strokeWidth
      : 1.5;
  const statusStroke =
    connectionStatus === "invalid"
      ? "#f87171"
      : connectionStatus === "valid"
        ? "#34d399"
        : CONNECTING_STROKE;

  return (
    <path
      d={path}
      fill="none"
      className="react-flow__connection-path canvas-connection-line-path"
      vectorEffect="non-scaling-stroke"
      style={{
        ...connectionLineStyle,
        stroke: statusStroke,
        strokeWidth,
        strokeDasharray: "6 4",
        filter:
          connectionStatus === "invalid"
            ? "drop-shadow(0 0 3px rgba(248, 113, 113, 0.55))"
            : connectionStatus === "valid"
              ? "drop-shadow(0 0 3px rgba(52, 211, 153, 0.55))"
              : "drop-shadow(0 0 3px rgba(14, 165, 233, 0.55))",
      }}
    />
  );
}
