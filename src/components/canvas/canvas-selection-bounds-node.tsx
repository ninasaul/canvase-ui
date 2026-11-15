"use client";

import { Plus } from "@phosphor-icons/react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo } from "react";

import { Icon } from "@/components/ui/icon";
import {
  SELECTION_BOUNDS_SOURCE_HANDLE,
} from "@/lib/canvas/canvas-selection-bounds";
import { messages } from "@/messages";
import { useCanvasPreferences } from "./canvas-preferences-context";

export type SelectionBoundsNodeData = {
  count: number;
};

/**
 * Highlighted box around a multi-selection, with one connection point on its
 * right edge: drag from it to wire every selected node to the target at once.
 *
 * `pointer-events-none` on the box keeps the nodes inside usable; only the
 * handle opts back into pointer events.
 */
export const SelectionBoundsNode = memo(function SelectionBoundsNode({
  data,
}: NodeProps & { data: SelectionBoundsNodeData }) {
  const { handleStyle } = useCanvasPreferences();
  const label = messages.canvas.selectionBoundsLabel.replace(
    "{count}",
    String(data.count),
  );

  return (
    <div className="pointer-events-none relative h-full w-full rounded-xl border-[1.5px] border-dashed border-sky-400/80 bg-sky-50/20 dark:border-sky-500/60 dark:bg-sky-950/20">
      <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-300/80 bg-white px-2.5 py-0.5 text-[10px] font-medium text-sky-700 shadow-sm dark:border-sky-600 dark:bg-zinc-900 dark:text-sky-300">
        {label}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id={SELECTION_BOUNDS_SOURCE_HANDLE}
        aria-label={messages.canvas.selectionBoundsConnect}
        className="group/selection-handle pointer-events-auto !right-0 !top-1/2 !z-30 !h-8 !w-8 !-translate-y-1/2 !translate-x-1/2 !border-0 !bg-transparent"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-sky-500 text-white shadow-md transition-[transform,box-shadow,background-color] duration-150 group-hover/selection-handle:scale-110 group-hover/selection-handle:bg-sky-400 group-hover/selection-handle:shadow-[0_0_0_4px_rgba(14,165,233,0.25)] dark:border-zinc-900">
          {handleStyle === "plus" ? (
            <Icon icon={Plus} size={14} />
          ) : handleStyle === "dot" ? (
            <span className="h-2.5 w-2.5 rounded-full bg-white" />
          ) : handleStyle === "ring" ? (
            <span className="h-3 w-3 rounded-full border-2 border-white" />
          ) : (
            <Icon icon={Plus} size={14} />
          )}
        </span>
      </Handle>
    </div>
  );
});
