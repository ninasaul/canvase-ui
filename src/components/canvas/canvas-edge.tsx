"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps,
  useNodesData,
} from "@xyflow/react";
import { useState, type CSSProperties } from "react";
import {
  edgeRoleOptions,
} from "@/lib/canvas/canvas-edge-roles";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/canvas-store";
import { useCanvasStore } from "@/lib/canvas/canvas-store";
import { messages } from "@/messages";
import { useCanvasDetail } from "./canvas-detail-context";
import { useCanvasPreferences } from "./canvas-preferences-context";

function roleLabel(role: string): string {
  switch (role) {
    case "prompt":
      return messages.canvas.promptInput;
    case "context":
      return messages.canvas.contextInput;
    case "reference_image":
      return messages.canvas.referenceImageInput;
    case "first_frame":
      return messages.canvas.firstFrameInput;
    case "last_frame":
      return messages.canvas.lastFrameInput;
    case "reference_video":
      return messages.canvas.referenceVideoInput;
    case "reference_audio":
      return messages.canvas.referenceAudioInput;
    default:
      return role;
  }
}

/** Edge with an inline role picker, starting with image targets. */
export function CanvasEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
  data,
}: EdgeProps<CanvasFlowEdge>) {
  const preferences = useCanvasPreferences();
  const { showEdgeLabels } = useCanvasDetail();
  const sourceNode = useNodesData<CanvasFlowNode>(source);
  const targetNode = useNodesData<CanvasFlowNode>(target);
  const sourceType = sourceNode?.type;
  const targetType = targetNode?.type;
  const role = data?.role ?? "prompt";
  const setEdgeRole = useCanvasStore((state) => state.setEdgeRole);
  const [editing, setEditing] = useState(false);

  const pathParams = {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  };
  const [path, labelX, labelY] =
    preferences.edgeType === "bezier"
      ? getBezierPath(pathParams)
      : preferences.edgeType === "straight"
        ? getStraightPath(pathParams)
        : getSmoothStepPath(pathParams);

  const options =
    sourceType && targetType ? edgeRoleOptions(sourceType, targetType) : [];
  const showPicker =
    (showEdgeLabels || Boolean(selected)) &&
    (targetType === "image" ||
      targetType === "video" ||
      targetType === "audio") &&
    options.length > 0;

  const selectedStyle: CSSProperties = selected
    ? {
        stroke: "#0ea5e9",
        strokeWidth: Math.max(
          2.5,
          Number(style?.strokeWidth ?? preferences.edgeWidth) + 1,
        ),
        filter: "drop-shadow(0 0 3px rgba(14, 165, 233, 0.55))",
      }
    : {};

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ ...style, ...selectedStyle }}
        interactionWidth={24}
      />
      {showPicker ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            <button
              type="button"
              className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium shadow-sm transition-colors ${
                selected
                  ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200"
                  : "border-zinc-200 bg-white/95 text-zinc-500 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
              title={messages.canvas.edgeRole}
              onClick={(event) => {
                event.stopPropagation();
                setEditing((open) => !open);
              }}
            >
              {roleLabel(role)}
            </button>
            {editing && options.length > 1 ? (
              <div className="absolute left-1/2 top-full z-50 mt-1 w-24 -translate-x-1/2 overflow-hidden rounded-lg border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                {options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="block w-full rounded-md px-2 py-1 text-left text-[10px] text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    onClick={(event) => {
                      event.stopPropagation();
                      setEdgeRole(id, option);
                      setEditing(false);
                    }}
                  >
                    {roleLabel(option)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const canvasEdgeTypes = {
  canvas: CanvasEdge,
} as const;
