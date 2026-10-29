"use client";

import {
  Copy,
  DownloadSimple,
  Eye,
  FolderMinus,
  Images,
  Info,
  PencilSimple,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { PlaygroundMediaLibraryPicker } from "@/components/playground/playground-media-library-picker";
import { Button } from "@/components/ui/button";
import { FieldSurface, FormField } from "@/components/form-field";
import { Modal } from "@/components/ui/modal";
import { PlaygroundChatMarkdown } from "@/components/playground/playground-chat-markdown";
import { CanvasNodeInfoModal } from "./canvas-node-info";
import { useCanvasActions } from "./canvas-actions";
import { Icon } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import { downloadCanvasNode } from "@/lib/canvas/canvas-download";
import type { PlaygroundUploadKind } from "@/lib/playground-media";
import {
  PLAYGROUND_AUDIO_ACCEPT,
  PLAYGROUND_IMAGE_ACCEPT,
  PLAYGROUND_VIDEO_ACCEPT,
  uploadPlaygroundAssetWithMeta,
} from "@/lib/playground-media";
import { useCanvasStore } from "@/lib/canvas/canvas-store";
import { messages } from "@/messages";

const acceptByType: Record<PlaygroundUploadKind, string> = {
  image: PLAYGROUND_IMAGE_ACCEPT,
  video: PLAYGROUND_VIDEO_ACCEPT,
  audio: PLAYGROUND_AUDIO_ACCEPT,
};

export function CanvasNodeHeaderActions({
  nodeId,
  mediaType,
}: {
  nodeId: string;
  mediaType?: PlaygroundUploadKind;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const node = useCanvasStore((state) =>
    state.nodes.find((item) => item.id === nodeId),
  );
  const { canvasId } = useCanvasActions();
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const removeNode = useCanvasStore((state) => state.removeNode);
  const duplicateNode = useCanvasStore((state) => state.duplicateNode);
  const removeNodeFromGroup = useCanvasStore(
    (state) => state.removeNodeFromGroup,
  );
  const setUploadProgress = useCanvasStore(
    (state) => state.setUploadProgress,
  );
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"markdown" | "raw">("markdown");
  const [downloading, setDownloading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  async function handleFile(file: File) {
    if (!mediaType || uploading) {
      return;
    }
    setUploading(true);
    setUploadProgress(nodeId, 0);
    try {
      const uploaded = await uploadPlaygroundAssetWithMeta(file, {
        allowedKinds: [mediaType],
        filename: file.name || mediaType,
        onProgress: (percent) => setUploadProgress(nodeId, percent),
      });
      const now = Date.now();
      updateNodeData(nodeId, {
        source: "upload",
        url: uploaded.url,
        urls: [uploaded.url],
        ...(uploaded.assetId
          ? { assetId: uploaded.assetId, assetIds: [uploaded.assetId] }
          : {}),
        status: "succeeded",
        error: undefined,
        startedAt: now,
        finishedAt: now,
      });
      toast.success(messages.canvas.uploadSuccess);
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : messages.canvas.uploadFailed,
      );
    } finally {
      setUploading(false);
      setUploadProgress(nodeId, null);
    }
  }

  async function handleDownload() {
    if (!node || downloading) {
      return;
    }
    setDownloading(true);
    try {
      await downloadCanvasNode(node, canvasId);
      toast.success(messages.canvas.downloadStarted);
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : messages.canvas.downloadFailed,
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="nodrag flex shrink-0 items-center gap-0.5">
      {node?.parentId ? (
        <Tooltip content={messages.canvas.removeFromGroup}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={messages.canvas.removeFromGroup}
            onClick={(event) => {
              event.stopPropagation();
              removeNodeFromGroup(nodeId);
              toast.success(messages.canvas.removedFromGroup);
            }}
          >
            <Icon icon={FolderMinus} size={13} />
          </Button>
        </Tooltip>
      ) : null}
      <Tooltip content={messages.canvas.copyNode}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={messages.canvas.copyNode}
          onClick={(event) => {
            event.stopPropagation();
            duplicateNode(nodeId);
            toast.success(messages.canvas.nodeCopied);
          }}
        >
          <Icon icon={Copy} size={13} />
        </Button>
      </Tooltip>
      {node &&
      (node.type === "image" || node.type === "video") &&
      node.data.url ? (
        <Tooltip content={messages.canvas.previewNode}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={messages.canvas.previewNode}
            onClick={(event) => {
              event.stopPropagation();
              setPreviewOpen(true);
            }}
          >
            <Icon icon={Eye} size={13} />
          </Button>
        </Tooltip>
      ) : null}
      {node &&
      (node.type === "text" ||
        node.type === "image" ||
        node.type === "video" ||
        node.type === "audio") ? (
        <Tooltip content={messages.canvas.downloadNode}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={
              downloading ||
              (node.type !== "text" &&
                !node.data.url &&
                !node.data.urls?.length)
            }
            aria-label={messages.canvas.downloadNode}
            onClick={(event) => {
              event.stopPropagation();
              void handleDownload();
            }}
          >
            <Icon icon={DownloadSimple} size={13} />
          </Button>
        </Tooltip>
      ) : null}
      <Tooltip content={messages.canvas.nodeInfo}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={messages.canvas.nodeInfo}
          onClick={(event) => {
            event.stopPropagation();
            setInfoOpen(true);
          }}
        >
          <Icon icon={Info} size={13} />
        </Button>
      </Tooltip>
      {node?.type === "text" ? (
        <Tooltip content={messages.canvas.viewText}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={messages.canvas.viewText}
            onClick={(event) => {
              event.stopPropagation();
              setViewMode("markdown");
              setViewOpen(true);
            }}
          >
            <Icon icon={Eye} size={13} />
          </Button>
        </Tooltip>
      ) : null}
      <Tooltip content={messages.canvas.renameNode}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={messages.canvas.renameNode}
          onClick={(event) => {
            event.stopPropagation();
            setNameDraft(node?.data.label ?? "");
            setRenameOpen(true);
          }}
        >
          <Icon icon={PencilSimple} size={13} />
        </Button>
      </Tooltip>
      {mediaType ? (
        <>
          <Tooltip content={messages.canvas.upload}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={uploading}
              aria-label={messages.canvas.upload}
              onClick={(event) => {
                event.stopPropagation();
                inputRef.current?.click();
              }}
            >
              <Icon icon={UploadSimple} size={13} />
            </Button>
          </Tooltip>
          <Tooltip content={messages.canvas.assetLibrary}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={messages.canvas.assetLibrary}
              onClick={(event) => {
                event.stopPropagation();
                setLibraryOpen(true);
              }}
            >
              <Icon icon={Images} size={13} />
            </Button>
          </Tooltip>
          <input
            ref={inputRef}
            type="file"
            accept={acceptByType[mediaType]}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) {
                void handleFile(file);
              }
            }}
          />
          <PlaygroundMediaLibraryPicker
            open={libraryOpen}
            onClose={() => setLibraryOpen(false)}
            allowedMediaTypes={[mediaType]}
            maxSelection={1}
            selectedUrls={[
              ...(node?.data.urls ?? []),
              node?.data.url ?? "",
            ].filter(Boolean)}
            onConfirm={(items) => {
              const item = items[0];
              if (!item) {
                return;
              }
              const now = Date.now();
              updateNodeData(nodeId, {
                source: "library",
                url: item.url,
                urls: [item.url],
                thumbnailUrl: item.thumbnailUrl ?? undefined,
                assetId: item.id,
                assetIds: [item.id],
                status: "succeeded",
                error: undefined,
                startedAt: now,
                finishedAt: now,
              });
              toast.success(messages.canvas.assetSelected);
            }}
            onUpload={() => {
              setLibraryOpen(false);
              inputRef.current?.click();
            }}
          />
        </>
      ) : null}
      <Tooltip content={messages.canvas.deleteNode}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-red-500 hover:text-red-600"
          aria-label={messages.canvas.deleteNode}
          onClick={(event) => {
            event.stopPropagation();
            removeNode(nodeId);
          }}
        >
          <Icon icon={Trash} size={13} />
        </Button>
      </Tooltip>

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={messages.canvas.previewNodeTitle}
        description={node?.data.label}
        size="6xl"
        closeLabel={messages.close}
        contentClassName="flex min-h-[min(60dvh,32rem)] items-center justify-center bg-zinc-950 p-3"
      >
        {node?.data.url ? (
          node.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- original canvas asset
            <img
              src={node.data.url}
              alt={node.data.label ?? ""}
              className="max-h-[78dvh] max-w-full object-contain"
            />
          ) : (
            <video
              src={node.data.url}
              controls
              autoPlay
              playsInline
              className="max-h-[78dvh] max-w-full"
            />
          )
        ) : null}
      </Modal>

      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title={messages.canvas.renameNode}
        size="md"
        closeLabel={messages.close}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRenameOpen(false)}
            >
              {messages.canvas.cancel}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                updateNodeData(nodeId, {
                  label: nameDraft.trim() || undefined,
                });
                setRenameOpen(false);
              }}
            >
              {messages.save}
            </Button>
          </div>
        }
      >
        <FieldSurface>
          <FormField
            name="canvas-node-name"
            label={messages.canvas.nodeName}
            value={nameDraft}
            onChange={setNameDraft}
            placeholder={messages.canvas.nodeNamePlaceholder}
            autoFocus
          />
        </FieldSurface>
      </Modal>

      <Modal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title={messages.canvas.viewText}
        size="5xl"
        closeLabel={messages.close}
        footer={
          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setViewOpen(false)}
            >
              {messages.close}
            </Button>
          </div>
        }
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-0.5 rounded-md bg-zinc-100 p-0.5 dark:bg-zinc-800">
            <button
              type="button"
              className={`rounded px-2.5 py-1 text-xs transition-colors ${
                viewMode === "markdown"
                  ? "bg-white text-zinc-800 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
              onClick={() => setViewMode("markdown")}
            >
              {messages.canvas.markdownPreview}
            </button>
            <button
              type="button"
              className={`rounded px-2.5 py-1 text-xs transition-colors ${
                viewMode === "raw"
                  ? "bg-white text-zinc-800 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
              onClick={() => setViewMode("raw")}
            >
              {messages.canvas.rawPreview}
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] tabular-nums text-zinc-400">
              {messages.playground.promptCharCount.replace(
                "{count}",
                String(node?.data.text?.length ?? 0),
              )}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!node?.data.text?.trim()}
              aria-label={messages.canvas.copyText}
              title={messages.canvas.copyText}
              onClick={() => {
                if (!node?.data.text) {
                  return;
                }
                void navigator.clipboard
                  .writeText(node.data.text)
                  .then(() => toast.success(messages.canvas.textCopied))
                  .catch(() => toast.danger(messages.copyFailed));
              }}
            >
              <Icon icon={Copy} size={13} />
            </Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
          {node?.data.text?.trim() ? (
            viewMode === "markdown" ? (
              <div className="max-h-[60vh] overflow-auto p-4">
                <PlaygroundChatMarkdown content={node.data.text} />
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-auto bg-zinc-50/70 dark:bg-zinc-900/40">
                <pre className="min-h-64 whitespace-pre-wrap break-words p-4 font-mono text-xs leading-6 text-zinc-700 dark:text-zinc-200">
                  {node.data.text}
                </pre>
              </div>
            )
          ) : (
            <p className="py-12 text-center text-xs text-zinc-400">
              {messages.canvas.emptyText}
            </p>
          )}
        </div>
      </Modal>

      <CanvasNodeInfoModal
        nodeId={nodeId}
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
    </div>
  );
}
