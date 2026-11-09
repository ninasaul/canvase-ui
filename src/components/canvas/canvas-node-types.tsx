"use client";

import { memo, useDeferredValue, useEffect, useRef, useState } from "react";

import {
  ArrowLeft,
  ArrowRight,
  ImageSquare,
  Plus,
  VideoCamera,
  Waveform,
} from "@phosphor-icons/react";
import {
  Handle,
  Position,
  type NodeProps,
} from "@xyflow/react";
import { useCanvasActions } from "@/components/canvas/canvas-actions";
import { Icon } from "@/components/ui/icon";
import { useCanvasDetail } from "@/components/canvas/canvas-detail-context";
import { getNodeById } from "@/lib/canvas/canvas-node-index";
import { useCanvasStore, type CanvasFlowNode } from "@/lib/canvas/canvas-store";
import {
  useCanvasRunStatus,
  useCanvasRunStatusStore,
} from "@/lib/canvas/canvas-run-status-store";
import { queryCanvasNodeTask } from "@/lib/canvas/canvas-task-recovery";
import { toast } from "@/components/ui/toast";
import { useCanvasPreferences } from "./canvas-preferences-context";
import {
  NODE_SELECTED_CLASS,
  NODE_SNAP_RING_CLASS,
  NODE_STYLE_CLASS,
  NODE_STYLE_HOVER_CLASS,
} from "./canvas-node-chrome";
import { canvasMediaNodeSize } from "@/lib/canvas/canvas-node-size";
import { NODE_TYPE_COLORS } from "@/components/canvas/editor/lib/constants";
import { messages } from "@/messages";
import { CanvasAudioPlayer } from "./canvas-audio-player";
import { CanvasVideoPlayer } from "./canvas-video-player";
import { GroupCanvasNode } from "./canvas-group-node";
import { CanvasNodeResizer } from "./canvas-node-resizer";
import { CanvasNodeToolbar } from "./canvas-node-toolbar";

function HandleBadge({
  color,
  side,
}: {
  color: string;
  side: "left" | "right";
}) {
  const { handleStyle } = useCanvasPreferences();
  const glyphClass =
    "text-white scale-75 opacity-0 transition-all duration-200 group-hover/node:scale-100 group-hover/node:opacity-100";
  return (
    <span
      className="canvas-handle-badge pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white opacity-0 shadow-sm transition-opacity duration-150 group-hover/node:opacity-100 dark:border-zinc-900"
      style={{ backgroundColor: color }}
    >
      {handleStyle === "plus" ? (
        <Icon icon={Plus} size={12} className={glyphClass} />
      ) : handleStyle === "dot" ? (
        <span className={`h-2 w-2 rounded-full bg-white ${glyphClass}`} />
      ) : handleStyle === "ring" ? (
        <span
          className={`h-2.5 w-2.5 rounded-full border-2 border-white ${glyphClass}`}
        />
      ) : (
        <Icon
          icon={side === "left" ? ArrowLeft : ArrowRight}
          size={13}
          className={glyphClass}
        />
      )}
    </span>
  );
}

function HandleHitArea() {
  return (
    <span className="pointer-events-auto absolute left-1/2 top-1/2 z-0 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full" />
  );
}

function InputHandle({
  id,
  label,
  color,
}: {
  id: string;
  label: string;
  color: string;
}) {
  return (
    <Handle
      type="target"
      position={Position.Left}
      id={id}
      aria-label={label}
      className="canvas-input-handle !z-30 !h-[2px] !w-[2px] !min-h-[2px] !min-w-[2px] !border-0 !bg-transparent"
    >
      <HandleHitArea />
      <HandleBadge color={color} side="left" />
    </Handle>
  );
}

function OutputHandle({ color, label }: { color: string; label?: string }) {
  return (
    <Handle
      type="source"
      position={Position.Right}
      id="out"
      aria-label={label}
      className="canvas-output-handle !z-30 !h-[2px] !w-[2px] !min-h-[2px] !min-w-[2px] !border-0 !bg-transparent"
    >
      <HandleHitArea />
      <HandleBadge color={color} side="right" />
    </Handle>
  );
}

function NodeShell({
  nodeId,
  selected,
  flush = false,
  children,
}: {
  nodeId: string;
  selected: boolean;
  /** Media nodes render content edge-to-edge without body padding. */
  flush?: boolean;
  children: React.ReactNode;
}) {
  const snapTarget = useCanvasStore(
    (state) => state.snapTargetId === nodeId,
  );
  const uploadProgress = useCanvasStore(
    (state) => state.uploadProgressById[nodeId],
  );
  const node = useCanvasStore((state) => getNodeById(state.nodes, nodeId));
  const runStatus = useCanvasRunStatus(nodeId);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const [querying, setQuerying] = useState(false);
  const queryControllerRef = useRef<AbortController | null>(null);
  const effectiveStatus = runStatus?.status ?? node?.data.status;
  const error = runStatus?.error ?? node?.data.error;
  const taskId =
    runStatus?.requestId ??
    runStatus?.taskId ??
    node?.data.requestId ??
    node?.data.taskId;
  const fallbackUrl = node?.data.url ?? "";

  useEffect(() => {
    return () => queryControllerRef.current?.abort();
  }, []);

  async function queryTask() {
    if (!taskId || querying) {
      return;
    }
    const mediaKind =
      node?.type === "video"
        ? "video"
        : node?.type === "image"
          ? "image"
          : null;
    if (!mediaKind) {
      toast.danger(messages.canvas.taskRecoveryFailed);
      return;
    }
    queryControllerRef.current?.abort();
    const controller = new AbortController();
    queryControllerRef.current = controller;
    setQuerying(true);
    useCanvasRunStatusStore
      .getState()
      .setNode(nodeId, "running", undefined, taskId, runStatus?.taskId);
    updateNodeData(nodeId, {
      status: "running",
      error: undefined,
    });
    try {
      await queryCanvasNodeTask({
        nodeId,
        requestId: taskId,
        mediaKind,
        fallbackUrl,
        signal: controller.signal,
        update: (id, patch) => {
          updateNodeData(id, patch);
          if (patch.status) {
            useCanvasRunStatusStore
              .getState()
              .setNode(
                id,
                patch.status,
                patch.error,
                taskId,
                runStatus?.taskId,
              );
          }
        },
      });
      if (controller.signal.aborted) {
        return;
      }
      const latest = useCanvasStore
        .getState()
        .nodes.find((item) => item.id === nodeId);
      if (latest?.data.status === "succeeded") {
        toast.success(messages.canvas.statusSucceeded);
      } else if (latest?.data.status === "failed") {
        toast.danger(
          latest.data.error?.trim() || messages.canvas.generationFailed,
        );
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const message =
          error instanceof Error
            ? error.message
            : messages.canvas.taskRecoveryFailed;
        toast.danger(message);
        updateNodeData(nodeId, {
          status: "interrupted",
          error: message,
        });
      }
    } finally {
      if (queryControllerRef.current === controller) {
        queryControllerRef.current = null;
        setQuerying(false);
      }
    }
  }

  const { nodeStyle } = useCanvasPreferences();
  return (
    <div
      className={`relative h-full w-full overflow-hidden transition-[border-color,background-color,box-shadow] duration-150 ${NODE_STYLE_CLASS[nodeStyle]} ${NODE_STYLE_HOVER_CLASS[nodeStyle]} ${
        snapTarget
          ? NODE_SNAP_RING_CLASS
          : selected
            ? NODE_SELECTED_CLASS
            : ""
      }`}
    >
      <div
        className={`canvas-node-body h-full min-h-0 ${
          flush ? "overflow-hidden" : "overflow-hidden p-2"
        }`}
      >
        {children}
      </div>
      {typeof uploadProgress === "number" ? (
        <NodeUploadOverlay progress={uploadProgress} />
      ) : null}
      {effectiveStatus === "failed" || effectiveStatus === "interrupted" ? (
        <div className="nodrag nopan absolute inset-x-1 bottom-1 z-30 rounded-md border border-red-200/80 bg-white/95 p-2 text-left shadow-lg backdrop-blur dark:border-red-900/70 dark:bg-zinc-900/95">
          <p
            className="line-clamp-2 text-[10px] leading-snug text-red-600 dark:text-red-300"
            title={error || messages.canvas.nodeErrorTitle}
          >
            {error || messages.canvas.nodeErrorTitle}
          </p>
          {taskId ? (
            <div className="mt-1 flex items-center justify-between gap-2">
              <span
                className="min-w-0 truncate font-mono text-[9px] text-zinc-400"
                title={taskId}
              >
                {messages.canvas.nodeTaskId}: {taskId}
              </span>
              <button
                type="button"
                className="nodrag nopan shrink-0 rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-[9px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                disabled={querying}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void queryTask();
                }}
              >
                {querying
                  ? messages.canvas.nodeQuerying
                  : messages.canvas.nodeQueryTask}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const UPLOAD_RING_RADIUS = 13;
const UPLOAD_RING_CIRCUMFERENCE = 2 * Math.PI * UPLOAD_RING_RADIUS;

function NodeUploadOverlay({ progress }: { progress: number }) {
  const clamped = Math.min(100, Math.max(0, progress));
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-zinc-900/90 px-2 py-1.5 text-white shadow-lg backdrop-blur-sm dark:bg-white/95 dark:text-zinc-900"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={messages.canvas.uploadingProgress.replace(
        "{percent}",
        String(clamped),
      )}
    >
      <span className="relative flex h-5 w-5 items-center justify-center">
        <svg
          className="absolute inset-0 h-5 w-5 -rotate-90"
          viewBox="0 0 36 36"
          aria-hidden
        >
          <circle
            cx="18"
            cy="18"
            r={UPLOAD_RING_RADIUS}
            fill="none"
            strokeWidth="4"
            className="stroke-white/20 dark:stroke-zinc-900/15"
          />
          <circle
            cx="18"
            cy="18"
            r={UPLOAD_RING_RADIUS}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={UPLOAD_RING_CIRCUMFERENCE}
            strokeDashoffset={
              UPLOAD_RING_CIRCUMFERENCE * (1 - clamped / 100)
            }
            className="stroke-white transition-[stroke-dashoffset] duration-200 ease-out dark:stroke-zinc-900"
          />
        </svg>
      </span>
      <span className="pr-0.5 tabular-nums text-[10px] font-semibold leading-none">
        {clamped}%
      </span>
    </div>
  );
}

function NodeRunningOverlay({
  nodeId,
  status,
  startedAt,
}: {
  nodeId: string;
  status: CanvasFlowNode["data"]["status"];
  startedAt?: number;
}) {
  const runStatus = useCanvasRunStatus(nodeId);
  const { cancelNodeRun } = useCanvasActions();
  const effectiveStatus = runStatus?.status ?? status;
  const running = effectiveStatus === "running";
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  if (effectiveStatus !== "running" && effectiveStatus !== "queued") {
    return null;
  }
  const elapsed =
    running && startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : null;

  return (
    <div
      role="status"
      aria-live="polite"
      // Matches the node's own corner radius and clips the sweep to it, so the
      // overlay no longer paints square corners over a rounded node.
      className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[inherit] bg-white/95 ring-1 ring-inset ring-sky-300/50 dark:bg-zinc-950/90 dark:ring-sky-500/30"
    >
      {running ? <span aria-hidden className="canvas-run-shimmer" /> : null}
      {running ? <span aria-hidden className="canvas-run-bar" /> : null}
      <span
        className={`relative text-[11px] font-semibold tracking-wide tabular-nums ${
          running
            ? "text-sky-600 dark:text-sky-400"
            : "text-zinc-500 dark:text-zinc-400"
        }`}
      >
        {running ? messages.canvas.executingNode : messages.canvas.statusQueued}
        {elapsed !== null ? ` · ${elapsed}s` : ""}
      </span>
      {running ? (
        <button
          type="button"
          className="relative rounded-full border border-zinc-200 bg-white/90 px-2 py-0.5 text-[10px] text-zinc-500 transition-colors pointer-events-auto hover:border-red-200 hover:text-red-500 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-400 dark:hover:border-red-900/60 dark:hover:text-red-400"
          onClick={(event) => {
            event.stopPropagation();
            cancelNodeRun(nodeId);
          }}
        >
          {messages.canvas.cancel}
        </button>
      ) : null}
    </div>
  );
}

function EmptyMedia({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex h-full min-h-16 flex-col items-center justify-center gap-1 text-zinc-300 dark:text-zinc-600">
      {icon}
      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
        {label}
      </span>
    </div>
  );
}

function MediaPreview({
  type,
  url,
  poster,
  preload,
  onAspectRatio,
}: {
  type: "image" | "video";
  url: string;
  poster?: string;
  preload?: "none" | "metadata" | "auto";
  onAspectRatio?: (ratio: number) => void;
}) {
  if (type === "image") {
    if (!url) {
      return null;
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element -- canvas media preview
      <img
        src={url}
        alt=""
        className="h-full w-full object-cover"
        draggable={false}
        loading="lazy"
        decoding="async"
        onLoad={(event) => {
          const image = event.currentTarget;
          if (image.naturalWidth > 0 && image.naturalHeight > 0) {
            onAspectRatio?.(image.naturalWidth / image.naturalHeight);
          }
        }}
      />
    );
  }
  return (
    <CanvasVideoPlayer
      key={url}
      src={url}
      poster={poster}
      preload={preload}
      onAspectRatio={onAspectRatio}
    />
  );
}

function nodePropsEqual(
  previous: NodeProps<CanvasFlowNode>,
  next: NodeProps<CanvasFlowNode>,
): boolean {
  return (
    previous.id === next.id &&
    previous.data === next.data &&
    previous.selected === next.selected &&
    previous.type === next.type
  );
}

/**
 * Level of detail: a plain block. Rendering the full node shell, handles and
 * overlays for 100+ nodes made panning unusable when zoomed out, and none of
 * that chrome is readable at that scale anyway.
 */
function NodeFarBlock({
  type,
  selected,
}: {
  type: CanvasFlowNode["type"];
  selected?: boolean;
}) {
  return (
    <div
      className={`h-full w-full rounded-lg border ${
        selected
          ? "border-sky-500 ring-2 ring-sky-400/40"
          : "border-zinc-300/80"
      }`}
      style={{
        backgroundColor:
          (NODE_TYPE_COLORS[type ?? "text"] ?? "#a1a1aa") + "26",
      }}
    />
  );
}

export const TextCanvasNode = memo(function TextCanvasNode({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  // Deferred so the LOD switch back to full nodes is rendered at low
  // priority: React can interrupt that pass and keep the zoom gesture
  // responsive instead of freezing while 100+ nodes mount their content.
  const { far: farTier } = useCanvasDetail();
  const far = useDeferredValue(farTier);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  if (far) {
    return <NodeFarBlock type="text" selected={Boolean(selected)} />;
  }
  return (
    <div className="group/node relative h-full w-full">
      <InputHandle
        id="context"
        label={messages.canvas.contextInput}
        color="#3b82f6"
      />
      <NodeShell
        nodeId={id}
        selected={Boolean(selected)}
      >
        {far ? (
          <p className="line-clamp-3 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {data.text?.trim() || messages.canvas.textNode}
          </p>
        ) : (
        <textarea
          className="nodrag nowheel h-full min-h-16 w-full resize-none border-0 bg-transparent p-0 text-[11px] leading-relaxed text-zinc-700 outline-none dark:text-zinc-200"
          value={data.text ?? ""}
          placeholder={messages.canvas.textPlaceholder}
          onChange={(event) => updateNodeData(id, { text: event.target.value })}
        />
        )}
      </NodeShell>
      <NodeRunningOverlay
        nodeId={id}
        status={data.status}
        startedAt={data.startedAt}
      />
      <OutputHandle color="#3b82f6" />
      {selected ? (
        <CanvasNodeResizer
          nodeId={id}
          selected
          minWidth={160}
          minHeight={100}
          keepAspectRatio={false}
        />
      ) : null}
      {selected ? (
        <CanvasNodeToolbar nodeId={id} type="text" selected />
      ) : null}
    </div>
  );
}, nodePropsEqual);



export const ImageCanvasNode = memo(function ImageCanvasNode({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  // Deferred so the LOD switch back to full nodes is rendered at low
  // priority: React can interrupt that pass and keep the zoom gesture
  // responsive instead of freezing while 100+ nodes mount their content.
  const { far: farTier } = useCanvasDetail();
  const far = useDeferredValue(farTier);
  const setNodeSize = useCanvasStore((state) => state.setNodeSize);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const uploading = useCanvasStore(
    (state) => typeof state.uploadProgressById[id] === "number",
  );
  if (far) {
    return <NodeFarBlock type="image" selected={Boolean(selected)} />;
  }
  return (
    <div className="group/node relative h-full w-full">
      <InputHandle
        id="in"
        label={messages.canvas.input}
        color="#10b981"
      />
      <NodeShell
        nodeId={id}
        selected={Boolean(selected)}
        flush
      >
        <div className="h-full overflow-hidden">
          {data.url ? (
            far ? null : (
            <div className="h-full">
            <MediaPreview
              type="image"
              url={data.thumbnailUrl || data.url}
              onAspectRatio={(ratio) => {
                const size = canvasMediaNodeSize("image", ratio);
                setNodeSize(id, size.width, size.height);
              }}
            />
            </div>
            )
          ) : uploading ? null : (
            <EmptyMedia
              icon={<Icon icon={ImageSquare} size={18} weight="fill" />}
              label={messages.canvas.emptyImage}
            />
          )}
        </div>
      </NodeShell>
      <NodeRunningOverlay
        nodeId={id}
        status={data.status}
        startedAt={data.startedAt}
      />
      <OutputHandle color="#10b981" />
      <CanvasNodeResizer nodeId={id} selected={Boolean(selected)} minWidth={160} minHeight={120} />
      {selected ? (
        <CanvasNodeToolbar nodeId={id} type="image" selected />
      ) : null}
    </div>
  );
}, nodePropsEqual);



export const VideoCanvasNode = memo(function VideoCanvasNode({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  // Deferred so the LOD switch back to full nodes is rendered at low
  // priority: React can interrupt that pass and keep the zoom gesture
  // responsive instead of freezing while 100+ nodes mount their content.
  const { far: farTier } = useCanvasDetail();
  const far = useDeferredValue(farTier);
  const setNodeSize = useCanvasStore((state) => state.setNodeSize);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const uploading = useCanvasStore(
    (state) => typeof state.uploadProgressById[id] === "number",
  );
  if (far) {
    return <NodeFarBlock type="video" selected={Boolean(selected)} />;
  }
  return (
    <div className="group/node relative h-full w-full">
      <InputHandle
        id="in"
        label={messages.canvas.input}
        color="#8b5cf6"
      />
      <NodeShell
        nodeId={id}
        selected={Boolean(selected)}
        flush
      >
        <div className="h-full overflow-hidden">
          {data.url ? (
            far ? null : (
            <div className="h-full">
            <MediaPreview
            type="video"
            url={data.url}
            poster={data.thumbnailUrl || undefined}
            preload={selected ? "metadata" : "none"}
            onAspectRatio={(ratio) => {
              const current = useCanvasStore
                .getState()
                .nodes.find((node) => node.id === id);
              if (current?.data.aspectRatio === ratio) {
                return;
              }
              const size = canvasMediaNodeSize("video", ratio);
              setNodeSize(id, size.width, size.height);
              updateNodeData(id, { aspectRatio: ratio });
            }}
          />
            </div>
            )
          ) : uploading ? null : (
            <EmptyMedia
              icon={<Icon icon={VideoCamera} size={18} weight="fill" />}
              label={messages.canvas.videoComingSoon}
            />
          )}
        </div>
      </NodeShell>
      <NodeRunningOverlay
        nodeId={id}
        status={data.status}
        startedAt={data.startedAt}
      />
      <OutputHandle color="#8b5cf6" label={messages.canvas.output} />
      <CanvasNodeResizer nodeId={id} selected={Boolean(selected)} minWidth={180} minHeight={120} />
      {selected ? (
        <CanvasNodeToolbar nodeId={id} type="video" selected />
      ) : null}
    </div>
  );
}, nodePropsEqual);



export const AudioCanvasNode = memo(function AudioCanvasNode({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  // Deferred so the LOD switch back to full nodes is rendered at low
  // priority: React can interrupt that pass and keep the zoom gesture
  // responsive instead of freezing while 100+ nodes mount their content.
  const { far: farTier } = useCanvasDetail();
  const far = useDeferredValue(farTier);
  const uploading = useCanvasStore(
    (state) => typeof state.uploadProgressById[id] === "number",
  );
  if (far) {
    return <NodeFarBlock type="audio" selected={Boolean(selected)} />;
  }
  return (
    <div className="group/node relative h-full w-full">
      <InputHandle
        id="in"
        label={messages.canvas.input}
        color="#f97316"
      />
      <NodeShell
        nodeId={id}
        selected={Boolean(selected)}
      >
        {data.url ? (
          far ? null : (
          <div>
            <CanvasAudioPlayer key={data.url} src={data.url} />
          </div>
          )
        ) : uploading ? null : (
          <EmptyMedia
            icon={<Icon icon={Waveform} size={18} weight="fill" />}
            label={messages.canvas.audioHint}
          />
        )}
      </NodeShell>
      <OutputHandle color="#f97316" label={messages.canvas.output} />
      {selected ? (
        <CanvasNodeResizer
          nodeId={id}
          selected
          minWidth={200}
          minHeight={100}
          keepAspectRatio={false}
        />
      ) : null}
      {selected ? (
        <CanvasNodeToolbar nodeId={id} type="audio" selected />
      ) : null}
    </div>
  );
}, nodePropsEqual);



export const canvasNodeTypes = {
  text: TextCanvasNode,
  image: ImageCanvasNode,
  video: VideoCanvasNode,
  audio: AudioCanvasNode,
  group: GroupCanvasNode,
} as const;
