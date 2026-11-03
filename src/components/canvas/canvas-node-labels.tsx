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
import { useStore, useViewport } from "@xyflow/react";
import { canvasNodeAbsolutePosition } from "@/lib/canvas/canvas-node-position";
import { Icon } from "@/components/ui/icon";
import { useCanvasStore } from "@/lib/canvas/canvas-store";
import type { CanvasFlowNode } from "@/lib/canvas/canvas-store";
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

export function CanvasNodeLabels({
  nodes,
}: {
  nodes: CanvasFlowNode[];
}) {
  // Split so the viewport subscription does not run during a pan: the inner
  // component is unmounted while the pane moves, which removes the per-frame
  // work entirely instead of just skipping the returned markup.
  const paneDragging = useStore((state) => state.paneDragging);
  if (paneDragging) {
    return null;
  }
  return <CanvasNodeLabelsInner nodes={nodes} />;
}

function CanvasNodeLabelsInner({ nodes }: { nodes: CanvasFlowNode[] }) {
  const viewport = useViewport();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const showDetail = viewport.zoom >= 0.35;
  const visibleNodes =
    width > 0 && height > 0
      ? nodes.filter((node) => {
          if (!showDetail && !node.selected && node.type !== "group") {
            return false;
          }
          const position = canvasNodeAbsolutePosition(node, byId);
          const left = viewport.x + position.x * viewport.zoom;
          const top = viewport.y + position.y * viewport.zoom;
          const right =
            left + (node.width ?? node.measured?.width ?? 280) * viewport.zoom;
          const bottom =
            top + (node.height ?? node.measured?.height ?? 200) * viewport.zoom;
          return right > -80 && bottom > -80 && left < width + 80 && top < height + 80;
        })
      : nodes;
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
    const scale = viewport.zoom || 1;
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
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {visibleNodes.map((node) => {
        const position = canvasNodeAbsolutePosition(node, byId);
        const type = node.type ?? "text";
        // Group title lives inside the group node chrome.
        if (type === "group") {
          return null;
        }
        const label = node.data.label?.trim() || typeName(type);
        return (
          <div
            key={node.id}
            className="pointer-events-auto absolute flex cursor-grab select-none items-center gap-1.5 whitespace-nowrap rounded-md px-0.5 pb-0.5 text-[11px] font-medium text-zinc-600 active:cursor-grabbing dark:text-zinc-300"
            style={{
              left: viewport.x + position.x * viewport.zoom,
              top: viewport.y + position.y * viewport.zoom,
              transform: `translateY(-100%) scale(${viewport.zoom})`,
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
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_COLORS[node.data.status]}`}
                title={node.data.status}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
