"use client";

import {
  Folder,
  ImageSquare,
  TextT,
  VideoCamera,
  Waveform,
} from "@phosphor-icons/react";
import type {
  CanvasNodeRunStatus,
  CanvasNodeType,
} from "@/lib/tu-shared-browser";
import { memo } from "react";
import { useStoreApi, ViewportPortal } from "@xyflow/react";
import { canvasNodeAbsolutePosition } from "@/lib/canvas/canvas-node-position";
import { Icon } from "@/components/ui/icon";
import { useCanvasStore } from "@/lib/canvas/canvas-store";
import type { CanvasFlowNode } from "@/lib/canvas/canvas-store";
import { getNodeIndex } from "@/lib/canvas/canvas-node-index";
import { useLabelEntries } from "@/lib/canvas/canvas-selectors";
import { messages } from "@/messages";

const NODE_ICONS: Record<CanvasNodeType, typeof TextT> = {
  text: TextT,
  image: ImageSquare,
  video: VideoCamera,
  audio: Waveform,
  group: Folder,
};

const NODE_COLORS: Record<CanvasNodeType, string> = {
  text: "#3b82f6",
  image: "#10b981",
  video: "#8b5cf6",
  audio: "#f97316",
  group: "#94a3b8",
};

const STATUS_COLORS: Record<CanvasNodeRunStatus, string> = {
  idle: "bg-zinc-300 dark:bg-zinc-600",
  queued: "bg-amber-400",
  running: "bg-sky-500 animate-pulse",
  succeeded: "bg-emerald-500",
  failed: "bg-red-500",
  skipped: "bg-orange-400",
  cancelled: "bg-zinc-400",
  interrupted: "bg-amber-600",
};

function typeName(type: CanvasNodeType): string {
  switch (type) {
    case "image":
      return messages.canvas.imageNode;
    case "video":
      return messages.canvas.videoNode;
    case "audio":
      return messages.canvas.audioNode;
    case "group":
      return messages.canvas.groupSelection;
    default:
      return messages.canvas.textNode;
  }
}

/**
 * Node labels, rendered inside the React Flow viewport portal.
 *
 * Living in the portal means pan/zoom moves them with the graph through the
 * compositor: no per-frame position math, no unmount/remount flash during a
 * gesture, and no `useViewport()` subscription. Overview zoom hides them via
 * the `.canvas-far` CSS class instead of a JS filter, and the label data
 * comes from a cached snapshot so editing a node's prompt does not re-render
 * the layer.
 */
export const CanvasNodeLabels = memo(function CanvasNodeLabels() {
  const storeApi = useStoreApi();
  const entries = useLabelEntries();
  // Absolute positions still need the live node graph (parents move children).
  const byId = getNodeIndex(useCanvasStore.getState().nodes);
  const setNodePosition = useCanvasStore((state) => state.setNodePosition);
  const selectNode = useCanvasStore((state) => state.selectNode);

  function startDrag(
    event: React.PointerEvent<HTMLDivElement>,
    node: CanvasFlowNode,
  ) {
    event.preventDefault();
    event.stopPropagation();
    selectNode(node.id);
    const startX = event.clientX;
    const startY = event.clientY;
    const startPosition = { ...node.position };
    // Read the zoom once, at pointer-down: subscribing to the transform would
    // re-render every label on each pan/zoom frame.
    const scale = storeApi.getState().transform[2] || 1;
    const onMove = (moveEvent: PointerEvent) => {
      setNodePosition(
        node.id,
        startPosition.x + (moveEvent.clientX - startX) / scale,
        startPosition.y + (moveEvent.clientY - startY) / scale,
      );
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <ViewportPortal>
      {/* `absolute left-0 top-0` makes this the containing block for the
          labels, so their left/top are flow coordinates: the viewport applies
          the pan/zoom transform to the whole layer. */}
      <div className="canvas-node-labels pointer-events-none absolute left-0 top-0">
        {entries.map(({ node }) => {
          const position = canvasNodeAbsolutePosition(node, byId);
          const type = node.type ?? "text";
          // The group title lives inside the group node chrome.
          if (type === "group") {
            return null;
          }
          const label = node.data.label?.trim() || typeName(type);
          return (
            <div
              key={node.id}
              data-node-id={node.id}
              data-selected={node.selected ? "true" : undefined}
              className="canvas-node-label pointer-events-auto absolute flex cursor-grab select-none items-center gap-1.5 whitespace-nowrap rounded-md px-0.5 pb-0.5 text-[11px] font-medium text-zinc-600 active:cursor-grabbing dark:text-zinc-300"
              style={{
                left: position.x + 8,
                top: position.y,
                transform: "translateY(calc(-100% - 4px))",
                transformOrigin: "left bottom",
              }}
              onPointerDown={(event) => startDrag(event, node)}
              title={
                node.data.model?.trim()
                  ? `${label} · ${node.data.model.trim()}`
                  : label
              }
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className="inline-flex shrink-0"
                  style={{ color: NODE_COLORS[type] }}
                >
                  <Icon icon={NODE_ICONS[type]} size={12} weight="fill" />
                </span>
                <span className="truncate">{label}</span>
              </span>
              {node.data.status && node.data.status !== "idle" ? (
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    STATUS_COLORS[node.data.status]
                  }`}
                  title={node.data.status}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </ViewportPortal>
  );
});
