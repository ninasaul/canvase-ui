"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CaretDown } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import type { CanvasFlowNode } from "@/lib/canvas/canvas-store";
import { messages } from "@/messages";

import { nodeStatusLabel, nodeTypeLabel } from "../lib/node-display";

/**
 * Table of every node with type, status, model, size and group. Groups are
 * shown as trees and can be collapsed; the collapsed set is local to the
 * dialog so it does not survive closing.
 */
export function CanvasNodeInfoModal({
  open,
  nodes,
  onClose,
}: {
  open: boolean;
  nodes: CanvasFlowNode[];
  onClose: () => void;
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );

  const { infoNodes, infoRows, childCounts } = useMemo(() => {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    if (!open) {
      return {
        infoNodes: new Map<string, CanvasFlowNode>(),
        infoRows: [] as Array<{ node: CanvasFlowNode; depth: number }>,
        childCounts: new Map<string, number>(),
      };
    }
    const childrenByParent = new Map<string, CanvasFlowNode[]>();
    for (const node of nodes) {
      if (!node.parentId || !byId.has(node.parentId)) {
        continue;
      }
      const list = childrenByParent.get(node.parentId) ?? [];
      list.push(node);
      childrenByParent.set(node.parentId, list);
    }
    const rows: Array<{ node: CanvasFlowNode; depth: number }> = [];
    const visited = new Set<string>();
    const append = (node: CanvasFlowNode, depth: number) => {
      if (visited.has(node.id)) {
        return;
      }
      visited.add(node.id);
      rows.push({ node, depth });
      if (node.type === "group" && !collapsedGroups.has(node.id)) {
        for (const child of childrenByParent.get(node.id) ?? []) {
          append(child, depth + 1);
        }
      }
    };
    for (const node of nodes) {
      if (!node.parentId || !byId.has(node.parentId)) {
        append(node, 0);
      }
    }
    const counts = new Map<string, number>();
    for (const node of nodes) {
      if (node.parentId) {
        counts.set(node.parentId, (counts.get(node.parentId) ?? 0) + 1);
      }
    }
    return { infoNodes: byId, infoRows: rows, childCounts: counts };
  }, [collapsedGroups, nodes, open]);

  if (!open) {
    return null;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={messages.canvas.nodeInfo}
      size="5xl"
      closeLabel={messages.close}
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {messages.close}
          </Button>
        </div>
      }
    >
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-400 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 font-medium">
                  {messages.canvas.nodeName}
                </th>
                <th className="px-3 py-2 font-medium">
                  {messages.canvas.nodeType}
                </th>
                <th className="px-3 py-2 font-medium">
                  {messages.canvas.nodeStatus}
                </th>
                <th className="px-3 py-2 font-medium">
                  {messages.canvas.nodeModel}
                </th>
                <th className="px-3 py-2 font-medium">
                  {messages.canvas.nodeSize}
                </th>
                <th className="px-3 py-2 font-medium">
                  {messages.canvas.nodeGroup}
                </th>
                <th className="px-3 py-2 font-medium">{messages.canvas.nodeId}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {infoRows.map(({ node, depth }) => {
                const typeName = nodeTypeLabel(node.type);
                const title = node.data.label?.trim() || typeName;
                const group = node.parentId
                  ? infoNodes.get(node.parentId)
                  : undefined;
                const groupName = group
                  ? group.data.label?.trim() ||
                    messages.canvas.groupNamePlaceholder
                  : "—";
                const status =
                  node.type === "group"
                    ? "—"
                    : nodeStatusLabel(node.data.status);
                const width = node.width ?? node.measured?.width;
                const height = node.height ?? node.measured?.height;
                const isGroup = node.type === "group";
                const expanded = !collapsedGroups.has(node.id);
                const childCount = childCounts.get(node.id) ?? 0;
                const toggleCollapsed = () => {
                  setCollapsedGroups((current) => {
                    const next = new Set(current);
                    if (next.has(node.id)) {
                      next.delete(node.id);
                    } else {
                      next.add(node.id);
                    }
                    return next;
                  });
                };
                return (
                  <tr
                    key={node.id}
                    className={
                      isGroup
                        ? "bg-zinc-50/60 text-zinc-600 hover:bg-zinc-100/70 dark:bg-zinc-900/40 dark:text-zinc-300 dark:hover:bg-zinc-800/40"
                        : "text-zinc-600 hover:bg-zinc-50/70 dark:text-zinc-300 dark:hover:bg-zinc-800/40"
                    }
                  >
                    <td className="max-w-56 px-3 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                      <div
                        className="flex min-w-0 items-center gap-1.5"
                        style={{ paddingLeft: depth * 18 }}
                      >
                        {isGroup ? (
                          <button
                            type="button"
                            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                            aria-expanded={expanded}
                            aria-label={
                              expanded
                                ? messages.canvas.collapseGroup
                                : messages.canvas.expandGroup
                            }
                            onClick={toggleCollapsed}
                          >
                            <Icon
                              icon={expanded ? CaretDown : ArrowRight}
                              size={11}
                            />
                          </button>
                        ) : (
                          <span className="h-4 w-4 shrink-0" />
                        )}
                        <span className="truncate">{title}</span>
                        {isGroup ? (
                          <span className="shrink-0 text-[10px] font-normal text-zinc-400">
                            {childCount}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{typeName}</td>
                    <td className="whitespace-nowrap px-3 py-2">{status}</td>
                    <td className="max-w-36 truncate px-3 py-2">
                      {node.data.model || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                      {width && height
                        ? `${Math.round(width)} × ${Math.round(height)}`
                        : "—"}
                    </td>
                    <td className="max-w-36 truncate px-3 py-2">{groupName}</td>
                    <td
                      className="max-w-28 truncate px-3 py-2 font-mono text-[10px] text-zinc-400"
                      title={node.id}
                    >
                      {node.id}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-2 text-right text-[10px] tabular-nums text-zinc-400">
        {messages.canvas.groupNodeCount.replace("{count}", String(nodes.length))}
      </p>
    </Modal>
  );
}
