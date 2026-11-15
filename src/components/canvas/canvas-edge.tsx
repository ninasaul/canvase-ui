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
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Scissors } from "@phosphor-icons/react";
import { useStore, useReactFlow } from "@xyflow/react";
import {
  edgeRoleOptions,
} from "@/lib/canvas/canvas-edge-roles";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/canvas-store";
import { useCanvasStore } from "@/lib/canvas/canvas-store";
import { useCanvasEdgeHighlightStore } from "@/lib/canvas/canvas-edge-highlight-store";
import { useCanvasInteractionStore } from "@/lib/canvas/canvas-interaction-store";
import { useCanvasEdgeHoverStore } from "@/lib/canvas/canvas-edge-hover-store";
import { messages } from "@/messages";
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

/**
 * Cut button shown while an edge is hovered. Mounted only on hover so the
 * zoom subscription it needs stays off the hot path, and counter-scaled so it
 * keeps its screen size at any canvas zoom (ported from the reference canvas).
 */
function CanvasEdgeCutButton({
  labelX,
  labelY,
  onEnter,
  onLeave,
  onDelete,
}: {
  labelX: number;
  labelY: number;
  onEnter: () => void;
  onLeave: () => void;
  onDelete: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  const zoom = useStore((state) => state.transform[2]);
  return (
    <EdgeLabelRenderer>
      <div
        className="canvas-edge-cut nodrag nopan pointer-events-auto absolute"
        style={{
          transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px) scale(${1 / Math.max(zoom, 0.05)})`,
          zIndex: 1000,
        }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <button
          type="button"
          aria-label={messages.canvas.deleteEdge}
          title={messages.canvas.deleteEdge}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-600 shadow-md transition-[transform,background-color,border-color,color,box-shadow] duration-150 hover:scale-110 hover:border-red-500 hover:bg-red-500 hover:text-white hover:shadow-[0_0_0_3px_rgba(239,68,68,0.22)] active:scale-100 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-red-500 dark:hover:bg-red-500 dark:hover:text-white"
          onClick={onDelete}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <Scissors size={10} />
        </button>
      </div>
    </EdgeLabelRenderer>
  );
}

/** Edge with an inline role picker, starting with image targets. */
/**
 * Memoised: xyflow re-renders every edge wrapper when the viewport or the node
 * set changes, and without a boundary here each of those passes re-rendered the
 * path/label tree of all ~100 edges.
 */
function edgePropsEqual(
  previous: EdgeProps<CanvasFlowEdge>,
  next: EdgeProps<CanvasFlowEdge>,
): boolean {
  return (
    previous.id === next.id &&
    previous.source === next.source &&
    previous.target === next.target &&
    previous.sourceX === next.sourceX &&
    previous.sourceY === next.sourceY &&
    previous.targetX === next.targetX &&
    previous.targetY === next.targetY &&
    previous.sourcePosition === next.sourcePosition &&
    previous.targetPosition === next.targetPosition &&
    previous.selected === next.selected &&
    previous.markerEnd === next.markerEnd &&
    previous.style === next.style &&
    previous.data === next.data
  );
}

export const CanvasEdge = memo(function CanvasEdge({
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
  const sourceNode = useNodesData<CanvasFlowNode>(source);
  const targetNode = useNodesData<CanvasFlowNode>(target);
  const sourceType = sourceNode?.type;
  const targetType = targetNode?.type;
  const role = data?.role ?? "prompt";
  const setEdgeRole = useCanvasStore((state) => state.setEdgeRole);
  const [editing, setEditing] = useState(false);
  const { deleteElements } = useReactFlow();
  const setHoveredEdge = useCanvasEdgeHoverStore(
    (state) => state.setHoveredEdge,
  );
  const clearHoveredEdge = useCanvasEdgeHoverStore(
    (state) => state.clearHoveredEdge,
  );
  // Either endpoint selected → this edge belongs to the selection and lights
  // up, so a selected node's connections are readable at a glance.
  const endpointSelected = useCanvasEdgeHighlightStore((state) =>
    state.selectedIds.has(source) || state.selectedIds.has(target),
  );
  // While any gesture moves one of this edge's endpoints (a group drag moves
  // its children too), the edge lights up: its geometry is changing under the
  // pointer and it belongs to what the user is holding.
  const dragAffected = useCanvasInteractionStore((state) =>
    state.dragAffectedNodeIds.has(source) ||
    state.dragAffectedNodeIds.has(target),
  );
  const [hovered, setHovered] = useState(false);
  const leaveTimerRef = useRef<number | null>(null);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const handleEnter = useCallback(() => {
    clearLeaveTimer();
    setHovered(true);
    setHoveredEdge({ edgeId: id, sourceId: source, targetId: target });
  }, [clearLeaveTimer, id, setHoveredEdge, source, target]);

  const handleLeave = useCallback(() => {
    clearLeaveTimer();
    // Small grace period: the pointer briefly leaves the 12px hit path while
    // travelling along a curve, and the highlight used to flicker.
    leaveTimerRef.current = window.setTimeout(() => {
      leaveTimerRef.current = null;
      setHovered(false);
      clearHoveredEdge(id);
    }, 80);
  }, [clearLeaveTimer, clearHoveredEdge, id]);

  useEffect(() => {
    return () => {
      clearLeaveTimer();
      clearHoveredEdge(id);
    };
  }, [clearHoveredEdge, clearLeaveTimer, id]);

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
  // Only an explicitly selected edge shows its role chip: a chip on every edge
  // in the middle of the canvas is pure clutter, but the role is still
  // editable — select the edge and the chip appears.
  const showPicker =
    Boolean(selected) &&
    (targetType === "image" ||
      targetType === "video" ||
      targetType === "audio") &&
    options.length > 0;

  // Drop an open dropdown when the edge loses the selection.
  useEffect(() => {
    if (!selected) {
      setEditing(false);
    }
  }, [selected]);

  const baseWidth = Number(style?.strokeWidth ?? preferences.edgeWidth);
  const selectedStyle: CSSProperties = selected
    ? {
        stroke: "#0ea5e9",
        strokeWidth: Math.max(2.5, baseWidth + 1),
        filter: "drop-shadow(0 0 3px rgba(14, 165, 233, 0.55))",
      }
    : {};

  const hoveredStyle: CSSProperties =
    hovered && !selected
      ? {
          stroke: "#38bdf8",
          strokeWidth: Math.max(2, baseWidth + 1),
          filter: "drop-shadow(0 0 2px rgba(56, 189, 248, 0.45))",
        }
      : {};
  // Dragging highlight: colour + glow only, no thicken (a thick stroke reads as
  // selected and fights the selection ring).
  const draggingStyle: CSSProperties =
    dragAffected && !selected
      ? {
          stroke: "#0ea5e9",
          filter: "drop-shadow(0 0 3px rgba(14, 165, 233, 0.5))",
        }
      : {};
  // Softer than a direct selection: the edge belongs to a selected node.
  const relatedStyle: CSSProperties =
    endpointSelected && !selected && !hovered
      ? {
          stroke: "#0ea5e9",
          strokeWidth: Math.max(2, baseWidth + 0.5),
          filter: "drop-shadow(0 0 2px rgba(14, 165, 233, 0.35))",
        }
      : {};

  const showCutButton = hovered && !selected && !editing;
  const handleDelete = useCallback(
    async (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      clearLeaveTimer();
      setHovered(false);
      clearHoveredEdge(id);
      await deleteElements({ edges: [{ id }] });
    },
    [clearHoveredEdge, clearLeaveTimer, deleteElements, id],
  );

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        // Keep the stroke a constant screen width: SVG stroke widths are in
        // flow units, so at overview zoom (10% on a big canvas) a 1.5px edge
        // rendered at 0.15px and the connections looked like they were gone.
        vectorEffect="non-scaling-stroke"
        style={{
          ...style,
          ...relatedStyle,
          ...hoveredStyle,
          ...draggingStyle,
          ...selectedStyle,
        }}
        interactionWidth={0}
      />
      {/* Generous invisible hit path: hover must be easy on a thin line. */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        className="canvas-edge-hit react-flow__edge-interaction"
        vectorEffect="non-scaling-stroke"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      />
      {showCutButton ? (
        <CanvasEdgeCutButton
          labelX={labelX}
          labelY={labelY}
          onEnter={handleEnter}
          onLeave={handleLeave}
          onDelete={handleDelete}
        />
      ) : null}
      {showPicker ? (
        <EdgeLabelRenderer>
          <div
            data-selected={selected ? "true" : undefined}
            data-open={editing ? "true" : undefined}
            className="canvas-edge-picker nodrag nopan pointer-events-auto absolute"
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
}, edgePropsEqual);

export const canvasEdgeTypes = {
  canvas: CanvasEdge,
} as const;
