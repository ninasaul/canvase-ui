"use client";

import { memo } from "react";
import { useShallow } from "zustand/react/shallow";

import { BoundingBox } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useCanvasStore } from "@/lib/canvas/canvas-store";
import { messages } from "@/messages";

/** Appears while two or more nodes are selected: count plus "create group". */
function CanvasSelectionBarInner({
  onCreateGroup,
}: {
  onCreateGroup: (count: number) => void;
}) {
  // Subscribe to the selection here instead of receiving an array from the
  // editor: the editor re-renders on every node change, and a fresh array per
  // render defeated memo. `useShallow` keeps identity stable while the
  // selection is unchanged.
  const selectedNodes = useCanvasStore(
    useShallow((state) =>
      state.nodes.filter(
        (node) => node.selected && node.type !== "group" && !node.parentId,
      ),
    ),
  );

  if (selectedNodes.length < 2) {
    return null;
  }
  return (
    <div className="nodrag absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-zinc-200 bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
      <Icon icon={BoundingBox} size={14} className="text-zinc-400" />
      <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
        {messages.canvas.selectedNodeCount.replace(
          "{count}",
          String(selectedNodes.length),
        )}
      </span>
      <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
      <Button
        variant="primary"
        size="sm"
        onClick={() => onCreateGroup(selectedNodes.length)}
      >
        {messages.canvas.createGroup}
      </Button>
    </div>
  );
}

export const CanvasSelectionBar = memo(CanvasSelectionBarInner);
