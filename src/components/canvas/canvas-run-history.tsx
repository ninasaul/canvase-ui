"use client";

import { ArrowsClockwise, Clock } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import {
  getCanvasRun,
  listCanvasRuns,
  type CanvasRunDetail,
  type CanvasRunSummary,
} from "@/lib/canvas/canvas-api";
import { messages } from "@/messages";

function modeLabel(mode: string): string {
  switch (mode) {
    case "selected":
      return messages.canvas.runSelected;
    case "from":
      return messages.canvas.runFrom;
    case "retry-failed":
      return messages.canvas.retryFailed;
    default:
      return messages.canvas.runAll;
  }
}

function statusClass(status: string): string {
  if (status === "succeeded") {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  if (status === "failed") {
    return "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300";
  }
  if (status === "partial") {
    return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  }
  if (status === "cancelled") {
    return "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";
  }
  return "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300";
}

function formatTime(value: string | null): string {
  if (!value) {
    return "—";
  }
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function formatDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt || !finishedAt) {
    return "—";
  }
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) {
    return "—";
  }
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function CanvasRunHistoryModal({
  open,
  onClose,
  canvasId,
}: {
  open: boolean;
  onClose: () => void;
  canvasId: string;
}) {
  const [runs, setRuns] = useState<CanvasRunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CanvasRunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function loadRuns() {
    setLoading(true);
    setError(null);
    try {
      setRuns(await listCanvasRuns(canvasId, 30));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : messages.canvas.runHistoryLoadFailed,
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId, open]);

  async function selectRun(id: string) {
    if (selectedId === id) {
      setSelectedId(null);
      setDetail(null);
      return;
    }
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await getCanvasRun(canvasId, id));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : messages.canvas.runHistoryLoadFailed,
      );
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={messages.canvas.runHistory}
      size="xl"
      closeLabel={messages.close}
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void loadRuns()}
            disabled={loading}
          >
            <Icon icon={ArrowsClockwise} size={13} />
            {messages.canvas.runHistoryRefresh}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {messages.close}
          </Button>
        </div>
      }
    >
      {loading ? (
        <p className="py-12 text-center text-sm text-zinc-400">
          {messages.loading}
        </p>
      ) : error ? (
        <p className="py-12 text-center text-sm text-red-500">{error}</p>
      ) : runs.length === 0 ? (
        <Empty icon={Clock} className="py-12">
          <p className="text-sm text-zinc-500">
            {messages.canvas.runHistoryEmpty}
          </p>
        </Empty>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <div
              key={run.id}
              className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                onClick={() => void selectRun(run.id)}
              >
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium ${statusClass(run.status)}`}
                >
                  {run.status}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-zinc-800 dark:text-zinc-100">
                    {modeLabel(run.mode)}
                    <span className="ml-2 font-normal text-zinc-400">
                      {run.nodeCount} {messages.canvas.runHistoryNodes}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-zinc-400">
                    {formatTime(run.createdAt)}
                    {" · "}
                    {formatDuration(run.startedAt, run.finishedAt)}
                  </span>
                </span>
                {run.error ? (
                  <span className="max-w-40 truncate text-[10px] text-red-500" title={run.error}>
                    {run.error}
                  </span>
                ) : null}
              </button>
              {selectedId === run.id ? (
                <div className="border-t border-zinc-100 bg-zinc-50/60 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
                  {detailLoading || !detail ? (
                    <p className="py-2 text-[11px] text-zinc-400">
                      {messages.loading}
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {detail.nodes.map((node) => (
                        <li
                          key={node.nodeId}
                          className="flex items-start gap-2 text-[10px]"
                        >
                          <span
                            className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                              node.status === "succeeded"
                                ? "bg-emerald-500"
                                : node.status === "failed"
                                  ? "bg-red-500"
                                  : node.status === "skipped"
                                    ? "bg-zinc-400"
                                    : "bg-amber-400"
                            }`}
                          />
                          <span className="min-w-0 flex-1 truncate font-mono text-zinc-500 dark:text-zinc-400">
                            {node.nodeId}
                          </span>
                          <span className="shrink-0 text-zinc-400">
                            {node.status}
                          </span>
                          {node.error ? (
                            <span className="max-w-56 truncate text-red-500" title={node.error}>
                              {node.error}
                            </span>
                          ) : null}
                          {node.requestId || node.taskId ? (
                            <span
                              className="shrink-0 truncate font-mono text-zinc-400"
                              title={node.requestId ?? node.taskId ?? ""}
                            >
                              {node.requestId ?? node.taskId}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
