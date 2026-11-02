"use client";

import {
  CircleNotch,
  DownloadSimple,
  UploadSimple,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { formatDateTime } from "@/lib/format";
import { messages } from "@/messages";

/** Canvas details: rename, counts, timestamps and JSON export. */
export function CanvasInfoModal({
  open,
  titleDraft,
  onTitleChange,
  nodeCount,
  edgeCount,
  createdAt,
  updatedAt,
  thumbnailUrl,
  thumbnailBusy,
  onPickThumbnail,
  onExport,
  onSubmit,
  onClose,
}: {
  open: boolean;
  titleDraft: string;
  onTitleChange: (next: string) => void;
  thumbnailUrl: string | null;
  thumbnailBusy: boolean;
  onPickThumbnail: () => void;
  nodeCount: number;
  edgeCount: number;
  createdAt: string;
  updatedAt: string;
  onExport: () => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={messages.canvas.canvasInfo}
      description={messages.canvas.canvasInfoHint}
      size="md"
      as="form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      closeLabel={messages.close}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {messages.cancel}
          </Button>
          <Button type="submit" variant="primary" size="sm">
            {messages.save}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            {messages.canvas.thumbnail}
          </p>
          <button
            type="button"
            disabled={thumbnailBusy}
            className="group relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 transition-colors disabled:cursor-wait dark:border-zinc-700 dark:bg-zinc-900"
            aria-label={
              thumbnailBusy
                ? messages.canvas.thumbnailUploading
                : thumbnailUrl
                  ? messages.canvas.thumbnailReplace
                  : messages.canvas.thumbnailUpload
            }
            onClick={() => {
              if (!thumbnailBusy) {
                onPickThumbnail();
              }
            }}
          >
            {thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- canvas thumbnail preview
              <img
                src={thumbnailUrl}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <span className="flex h-full flex-col items-center justify-center gap-2 px-4">
                <Icon
                  icon={UploadSimple}
                  size={22}
                  className="text-zinc-300 dark:text-zinc-600"
                />
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {messages.canvas.thumbnailUpload}
                </span>
              </span>
            )}
            {thumbnailBusy ? (
              <span className="absolute inset-0 flex items-center justify-center gap-2 bg-zinc-950/50">
                <Icon
                  icon={CircleNotch}
                  size={16}
                  className="animate-spin text-white"
                />
                <span className="text-xs font-medium text-white">
                  {messages.canvas.thumbnailUploading}
                </span>
              </span>
            ) : thumbnailUrl ? (
              <span className="absolute inset-0 flex items-center justify-center bg-zinc-950/40 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                <span className="rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-medium text-zinc-700 shadow-sm dark:bg-zinc-900/95 dark:text-zinc-100">
                  {messages.canvas.thumbnailReplace}
                </span>
              </span>
            ) : null}
          </button>
          <p className="text-[11px] leading-relaxed text-zinc-400">
            {messages.canvas.thumbnailHint}
          </p>
        </div>

        <FormField
          name="canvas-info-title"
          label={messages.canvas.canvasName}
          value={titleDraft}
          placeholder={messages.canvas.canvasNamePlaceholder}
          maxLength={120}
          autoFocus
          onChange={onTitleChange}
        />

        <div className="space-y-3 rounded-xl bg-zinc-50 px-3.5 py-3 dark:bg-zinc-900/60">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="flex items-baseline gap-1.5">
              <span className="text-base font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">
                {nodeCount}
              </span>
              <span className="text-[11px] text-zinc-400">
                {messages.canvas.nodesLabel}
              </span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-base font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">
                {edgeCount}
              </span>
              <span className="text-[11px] text-zinc-400">
                {messages.canvas.edgesLabel}
              </span>
            </span>
          </div>
          <dl className="space-y-1.5 border-t border-zinc-200/80 pt-2.5 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-3">
              <dt className="shrink-0 text-[11px] text-zinc-400">
                {messages.canvas.createdAt}
              </dt>
              <dd className="min-w-0 text-right text-[11px] tabular-nums text-zinc-600 dark:text-zinc-300">
                {formatDateTime(createdAt)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="shrink-0 text-[11px] text-zinc-400">
                {messages.canvas.updatedAt}
              </dt>
              <dd className="min-w-0 text-right text-[11px] tabular-nums text-zinc-600 dark:text-zinc-300">
                {formatDateTime(updatedAt)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex justify-start">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-zinc-500"
            onClick={onExport}
          >
            <Icon icon={DownloadSimple} size={13} />
            {messages.canvas.exportJson}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
