"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useCanvasStore } from "@/lib/canvas/canvas-store";
import { messages } from "@/messages";

function typeName(type: string | undefined): string {
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

function statusName(status: string | undefined): string {
  switch (status) {
    case "queued":
      return messages.canvas.statusQueued;
    case "running":
      return messages.canvas.statusRunning;
    case "succeeded":
      return messages.canvas.statusSucceeded;
    case "failed":
      return messages.canvas.statusFailed;
    case "skipped":
      return messages.canvas.statusSkipped;
    case "cancelled":
      return messages.canvas.statusCancelled;
    case "interrupted":
      return messages.canvas.statusInterrupted;
    default:
      return messages.canvas.statusIdle;
  }
}

export function CanvasNodeInfoModal({
  nodeId,
  open,
  onClose,
}: {
  nodeId: string;
  open: boolean;
  onClose: () => void;
}) {
  const node = useCanvasStore((state) =>
    state.nodes.find((item) => item.id === nodeId),
  );
  const parent = useCanvasStore((state) =>
    state.nodes.find((item) => item.id === node?.parentId),
  );

  if (!node) {
    return null;
  }

  const title =
    node.data.label?.trim() ||
    (node.type === "group"
      ? messages.canvas.groupSelection
      : typeName(node.type));
  const width = node.width ?? node.measured?.width;
  const height = node.height ?? node.measured?.height;
  const groupName = parent
    ? parent.data.label?.trim() || messages.canvas.groupNamePlaceholder
    : "—";
  const rows = [
    [messages.canvas.nodeName, title],
    [messages.canvas.nodeType, typeName(node.type)],
    [
      messages.canvas.nodeStatus,
      node.type === "group" ? "—" : statusName(node.data.status),
    ],
    [messages.canvas.nodeModel, node.data.model || "—"],
    [
      messages.canvas.nodeSize,
      width && height
        ? `${Math.round(width)} × ${Math.round(height)}`
        : "—",
    ],
    [messages.canvas.nodeGroup, groupName],
    [messages.canvas.nodeId, node.id],
    ...(node.data.url
      ? [[messages.canvas.nodeInfoUrl, node.data.url] as const]
      : []),
    ...(node.data.prompt
      ? [[messages.canvas.nodeInfoPrompt, node.data.prompt] as const]
      : []),
    ...(node.data.error
      ? [[messages.canvas.nodeInfoError, node.data.error] as const]
      : []),
    ...(node.data.requestId
      ? [[messages.canvas.nodeTaskId, node.data.requestId] as const]
      : []),
    ...(node.data.taskId
      ? [[messages.canvas.nodeTaskId, node.data.taskId] as const]
      : []),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={messages.canvas.nodeInfo}
      size="lg"
      closeLabel={messages.close}
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {messages.close}
          </Button>
        </div>
      }
    >
      <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {rows.map(([label, value], index) => (
          <div
            key={`${label}-${index}`}
            className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 py-2.5 text-xs"
          >
            <dt className="text-zinc-400">{label}</dt>
            <dd className="break-words text-zinc-700 dark:text-zinc-200">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
