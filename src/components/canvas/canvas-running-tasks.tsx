"use client";

import { CircleNotch, Pulse } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { useCanvasStore } from "@/lib/canvas/canvas-store";
import { useCanvasRunStatusStore } from "@/lib/canvas/canvas-run-status-store";
import { messages } from "@/messages";

function elapsedLabel(startedAt: number | undefined, now: number): string {
  if (!startedAt) {
    return "—";
  }
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function nodeTypeLabel(type: string | undefined): string {
  switch (type) {
    case "image":
      return messages.canvas.imageNode;
    case "video":
      return messages.canvas.videoNode;
    case "audio":
      return messages.canvas.audioNode;
    default:
      return messages.canvas.textNode;
  }
}

export function CanvasRunningTasksModal({
  open,
  onClose,
  runActive = false,
  onCancelRun,
}: {
  open: boolean;
  onClose: () => void;
  runActive?: boolean;
  onCancelRun?: () => void;
}) {
  const nodes = useCanvasStore((state) => state.nodes);
  const runStatusById = useCanvasRunStatusStore((state) => state.statusById);
  const [now, setNow] = useState(() => Date.now());
  const tasks = useMemo(
    () =>
      nodes
        .map((node) => ({
          node,
          status: runStatusById[node.id]?.status ?? node.data.status,
        }))
        .filter(
          (item) => item.status === "running" || item.status === "queued",
        ),
    [nodes, runStatusById],
  );

  useEffect(() => {
    if (!open || tasks.length === 0) {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open, tasks.length]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={messages.canvas.runningTasks}
      size="lg"
      closeLabel={messages.close}
      footer={
        <div className="flex items-center justify-between gap-2">
          {runActive && onCancelRun ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600"
              onClick={onCancelRun}
            >
              {messages.canvas.runCancel}
            </Button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            onClick={onClose}
          >
            {messages.close}
          </button>
        </div>
      }
    >
      {tasks.length === 0 ? (
        <Empty icon={Pulse} className="py-12">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {messages.canvas.runningTasksEmpty}
          </p>
        </Empty>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {tasks.map(({ node, status }) => {
            const type = node.type ?? "text";
            const title =
              node.data.label?.trim() || nodeTypeLabel(type);
            return (
              <div key={node.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300">
                  <Icon
                    icon={status === "queued" ? Pulse : CircleNotch}
                    size={14}
                    className={status === "running" ? "animate-spin" : ""}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-800 dark:text-zinc-100">
                      {title}
                    </span>
                    <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                      {status === "queued"
                        ? messages.canvas.statusQueued
                        : messages.canvas.statusRunning}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-zinc-400">
                    {nodeTypeLabel(type)}
                    {" · "}
                    {node.data.model || messages.canvas.noModel}
                    {" · "}
                    {elapsedLabel(node.data.startedAt, now)}
                  </p>
                  {node.data.requestId ? (
                    <p
                      className="mt-1 truncate font-mono text-[9px] text-zinc-400"
                      title={node.data.requestId}
                    >
                      {messages.canvas.taskId}: {node.data.requestId}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
