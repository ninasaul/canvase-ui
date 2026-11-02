"use client";

import { memo } from "react";

import {
  Copy,
  Folder,
  FolderMinus,
  Info,
  PencilSimple,
  Play,
  PlusCircle,
  StopCircle,
  Trash,
} from "@phosphor-icons/react";
import { NodeToolbar, Position, type NodeProps } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CanvasNodeInfoModal } from "./canvas-node-info";
import { useCanvasActions } from "./canvas-actions";
import {
  GROUP_STYLE_CLASS,
  GROUP_STYLE_HOVER_CLASS,
  NODE_SELECTED_CLASS,
  NODE_SNAP_RING_CLASS,
} from "./canvas-node-chrome";
import { useCanvasPreferences } from "./canvas-preferences-context";
import { CanvasNodeResizer } from "./canvas-node-resizer";
import { FieldSurface, FormField } from "@/components/form-field";
import { Modal } from "@/components/ui/modal";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { useState } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import {
  useCanvasStore,
  type CanvasFlowNode,
} from "@/lib/canvas/canvas-store";
import { messages } from "@/messages";

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

export const GroupCanvasNode = memo(function GroupCanvasNode({
  id,
  data,
  selected,
}: NodeProps<CanvasFlowNode>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const removeNode = useCanvasStore((state) => state.removeNode);
  const ungroup = useCanvasStore((state) => state.ungroup);
  const addNodesToGroup = useCanvasStore((state) => state.addNodesToGroup);
  const duplicateNode = useCanvasStore((state) => state.duplicateNode);
  const nodes = useCanvasStore((state) => state.nodes);
  const {
    prepareRunSelected,
    cancelNodeRun,
    cancelActiveRun,
    isBatchRunActive,
  } = useCanvasActions();
  const dragOver = useCanvasStore(
    (state) => state.dragOverGroupId === id,
  );
  const multipleSelected = useCanvasStore(
    (state) => state.nodes.filter((node) => node.selected).length > 1,
  );
  const [renameOpen, setRenameOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [addIds, setAddIds] = useState<string[]>([]);
  const [draft, setDraft] = useState(data.label ?? "");
  const availableNodes = nodes.filter(
    (node) => node.type !== "group" && !node.parentId,
  );

  const { nodeStyle } = useCanvasPreferences();
  const children = nodes.filter((node) => node.parentId === id);
  const childCount = children.length;
  const runnableChildIds = children
    .filter(
      (node) =>
        node.type === "image" ||
        node.type === "video" ||
        node.type === "text",
    )
    .map((node) => node.id);
  const groupBusy =
    isBatchRunActive ||
    children.some(
      (node) =>
        node.data.status === "running" || node.data.status === "queued",
    );
  const title = data.label?.trim() || messages.canvas.groupDefault;
  const titleAccent = dragOver || selected;
  const minWidth = Math.max(
    260,
    ...children.map((node) => {
      const width = node.width ?? node.measured?.width ?? 220;
      return Math.ceil(node.position.x + width + 24);
    }),
  );
  const minHeight = Math.max(
    180,
    ...children.map((node) => {
      const height = node.height ?? node.measured?.height ?? 120;
      return Math.ceil(node.position.y + height + 24);
    }),
  );

  return (
    <>
    {/*
      Resizer must sit outside overflow-hidden, otherwise corner handles are clipped.
      Fragment children both mount under .react-flow__node-group.
    */}
    <CanvasNodeResizer
      nodeId={id}
      selected={Boolean(selected)}
      minWidth={minWidth}
      minHeight={minHeight}
      keepAspectRatio={false}
    />
    <div
      className={`relative h-full w-full overflow-hidden transition-[border-color,background-color,box-shadow] duration-150 ${GROUP_STYLE_CLASS[nodeStyle]} ${GROUP_STYLE_HOVER_CLASS[nodeStyle]} ${
        dragOver
          ? NODE_SNAP_RING_CLASS
          : selected
            ? NODE_SELECTED_CLASS
            : ""
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-[1] flex h-8 items-center gap-1.5 border-b px-2.5 ${
          titleAccent
            ? "border-sky-200/70 bg-sky-50/70 dark:border-sky-800/50 dark:bg-sky-950/45"
            : "border-zinc-200/70 bg-white/55 dark:border-zinc-700/55 dark:bg-zinc-950/45"
        }`}
      >
        <Icon
          icon={Folder}
          size={12}
          weight="fill"
          className={
            titleAccent
              ? "shrink-0 text-sky-500 dark:text-sky-400"
              : "shrink-0 text-zinc-400 dark:text-zinc-500"
          }
        />
        <span
          className={`min-w-0 flex-1 truncate text-[11px] font-medium ${
            titleAccent
              ? "text-sky-700 dark:text-sky-200"
              : "text-zinc-600 dark:text-zinc-300"
          }`}
        >
          {title}
        </span>
        <span
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${
            titleAccent
              ? "bg-sky-100/90 text-sky-600 dark:bg-sky-900/70 dark:text-sky-300"
              : "bg-zinc-100/90 text-zinc-500 dark:bg-zinc-800/90 dark:text-zinc-400"
          }`}
        >
          {messages.canvas.groupNodeCount.replace(
            "{count}",
            String(childCount),
          )}
        </span>
      </div>

      <NodeToolbar
        isVisible={selected && !multipleSelected}
        position={Position.Top}
        align="center"
        offset={12}
      >
        <div className="nodrag nopan flex items-center gap-0.5 rounded-lg border border-zinc-200/80 bg-white/95 p-1 shadow-sm backdrop-blur dark:border-zinc-700/80 dark:bg-zinc-900/95">
          <Tooltip
            content={
              groupBusy ? messages.canvas.runCancel : messages.canvas.runGroup
            }
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={
                groupBusy
                  ? "text-red-500 hover:text-red-600"
                  : "text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
              }
              aria-label={
                groupBusy
                  ? messages.canvas.runCancel
                  : messages.canvas.runGroup
              }
              disabled={!groupBusy && runnableChildIds.length === 0}
              onClick={(event) => {
                event.stopPropagation();
                if (groupBusy) {
                  for (const childId of runnableChildIds) {
                    cancelNodeRun(childId);
                  }
                  if (isBatchRunActive) {
                    cancelActiveRun();
                  }
                  return;
                }
                prepareRunSelected(runnableChildIds);
              }}
            >
              <Icon icon={groupBusy ? StopCircle : Play} size={13} />
            </Button>
          </Tooltip>
          <Tooltip content={messages.canvas.copyNode}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={messages.canvas.copyNode}
              onClick={(event) => {
                event.stopPropagation();
                duplicateNode(id);
                toast.success(messages.canvas.nodeCopied);
              }}
            >
              <Icon icon={Copy} size={13} />
            </Button>
          </Tooltip>
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
          <Tooltip content={messages.canvas.addNodesToGroup}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={messages.canvas.addNodesToGroup}
              onClick={(event) => {
                event.stopPropagation();
                setAddIds([]);
                setAddOpen(true);
              }}
            >
              <Icon icon={PlusCircle} size={13} />
            </Button>
          </Tooltip>
          <Tooltip content={messages.canvas.renameGroup}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={messages.canvas.renameGroup}
              onClick={(event) => {
                event.stopPropagation();
                setDraft(data.label ?? "");
                setRenameOpen(true);
              }}
            >
              <Icon icon={PencilSimple} size={13} />
            </Button>
          </Tooltip>
          <Tooltip content={messages.canvas.ungroup}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={messages.canvas.ungroup}
              onClick={(event) => {
                event.stopPropagation();
                ungroup(id);
              }}
            >
              <Icon icon={FolderMinus} size={13} />
            </Button>
          </Tooltip>
          <Tooltip content={messages.canvas.deleteGroup}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-red-500 hover:text-red-600"
              aria-label={messages.canvas.deleteGroup}
              onClick={(event) => {
                event.stopPropagation();
                removeNode(id);
              }}
            >
              <Icon icon={Trash} size={13} />
            </Button>
          </Tooltip>
        </div>
      </NodeToolbar>

      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title={messages.canvas.renameGroup}
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
                updateNodeData(id, { label: draft.trim() });
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
            name="canvas-group-rename"
            label={messages.canvas.groupName}
            value={draft}
            onChange={setDraft}
            autoFocus
          />
        </FieldSurface>
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={messages.canvas.addNodesToGroup}
        size="md"
        closeLabel={messages.close}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddOpen(false)}
            >
              {messages.canvas.cancel}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={addIds.length === 0}
              onClick={() => {
                addNodesToGroup(id, addIds);
                setAddOpen(false);
              }}
            >
              {messages.canvas.addToGroup}
            </Button>
          </div>
        }
      >
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {availableNodes.length === 0 ? (
            <p className="px-1 py-6 text-center text-xs text-zinc-400">
              {messages.canvas.noAvailableNodes}
            </p>
          ) : (
            availableNodes.map((node) => {
              const kind =
                node.type === "image"
                  ? messages.canvas.imageNode
                  : node.type === "video"
                    ? messages.canvas.videoNode
                    : node.type === "audio"
                      ? messages.canvas.audioNode
                      : messages.canvas.textNode;
              return (
                <label
                  key={node.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                >
                  <Checkbox
                    checked={addIds.includes(node.id)}
                    onChange={(checked) =>
                      setAddIds((current) =>
                        checked
                          ? [...current, node.id]
                          : current.filter((item) => item !== node.id),
                      )
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {node.data.label?.trim() || kind}
                  </span>
                  <span className="shrink-0 text-[10px] text-zinc-400">
                    {kind}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </Modal>

      <CanvasNodeInfoModal
        nodeId={id}
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
    </div>
    </>
  );
}, nodePropsEqual);


