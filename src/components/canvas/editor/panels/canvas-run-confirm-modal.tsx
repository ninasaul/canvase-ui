"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { messages } from "@/messages";

import { nodeTypeIcon, nodeTypeLabel } from "../lib/node-display";

export type RunConfirmRow = {
  id: string;
  label: string;
  type: string;
  meta: string;
  hasResult: boolean;
  isUpstream: boolean;
};

/** Confirmation dialog for a run plan: stats, type mix, node table. */
export function CanvasRunConfirmModal({
  open,
  count,
  overwrite,
  costLabel,
  typeMix,
  upstreamCount,
  showUpstreamToggle,
  includeUpstream,
  onIncludeUpstreamChange,
  rows,
  total,
  expanded,
  onToggleExpand,
  unpriced,
  onClose,
  onStart,
}: {
  open: boolean;
  count: number;
  overwrite: number;
  /** Already formatted, or "—" when nothing is priced. */
  costLabel: string;
  typeMix: Array<{ type: string; count: number }>;
  upstreamCount: number;
  showUpstreamToggle: boolean;
  includeUpstream: boolean;
  onIncludeUpstreamChange: (next: boolean) => void;
  rows: RunConfirmRow[];
  total: number;
  expanded: boolean;
  onToggleExpand: () => void;
  unpriced: boolean;
  onClose: () => void;
  onStart: () => void;
}) {
  if (!open) {
    return null;
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={messages.canvas.runConfirmTitle}
      size="2xl"
      closeLabel={messages.close}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {messages.cancel}
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={onStart}>
            {messages.canvas.runStartWithCount.replace("{count}", String(count))}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-zinc-200/80 px-3 py-2 dark:border-zinc-700/80">
            <p className="text-lg font-semibold leading-none text-zinc-900 dark:text-zinc-50">
              {count}
            </p>
            <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
              {messages.canvas.runStatNodes}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200/80 px-3 py-2 dark:border-zinc-700/80">
            <p
              className={`text-lg font-semibold leading-none ${
                overwrite > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-zinc-900 dark:text-zinc-50"
              }`}
            >
              {overwrite}
            </p>
            <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
              {messages.canvas.runStatOverwrite}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200/80 px-3 py-2 dark:border-zinc-700/80">
            <p className="text-lg font-semibold leading-none text-zinc-900 dark:text-zinc-50">
              {costLabel}
            </p>
            <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
              {messages.canvas.runStatCost}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          {typeMix.map((entry) => (
            <span key={entry.type}>
              {nodeTypeLabel(entry.type)} {entry.count}
            </span>
          ))}
          {upstreamCount > 0 ? (
            <span className="text-zinc-400 dark:text-zinc-500">
              · {upstreamCount} {messages.canvas.runUpstreamNodes}
            </span>
          ) : null}
        </div>

        {showUpstreamToggle ? (
          <div className="rounded-lg border border-zinc-200/80 px-3 py-2 dark:border-zinc-700/80">
            <Switch
              id="run-include-upstream"
              checked={includeUpstream}
              onChange={onIncludeUpstreamChange}
              label={messages.canvas.runIncludeUpstream}
              layout="between"
            />
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-400 dark:text-zinc-500">
              {messages.canvas.runIncludeUpstreamHint}
            </p>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-zinc-200/80 dark:border-zinc-700/80">
          <div className="max-h-72 divide-y divide-zinc-200/70 overflow-y-auto dark:divide-zinc-800">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <Icon
                  icon={nodeTypeIcon(row.type)}
                  size={13}
                  className="shrink-0 text-zinc-400"
                />
                <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-200">
                  {row.label}
                </span>
                {row.isUpstream ? (
                  <span className="shrink-0 rounded bg-zinc-100 px-1 py-0.5 text-[9px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {messages.canvas.runUpstreamTag}
                  </span>
                ) : null}
                {row.hasResult ? (
                  <span className="shrink-0 text-[9px] font-medium text-amber-600 dark:text-amber-400">
                    {messages.canvas.runOverwriteTag}
                  </span>
                ) : null}
                <span className="w-40 shrink-0 truncate text-right font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                  {row.meta}
                </span>
              </div>
            ))}
          </div>
          {total > rows.length || (expanded && total > 8) ? (
            <button
              type="button"
              className="w-full border-t border-zinc-200/80 px-3 py-1.5 text-left text-[10px] text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-600 dark:border-zinc-800 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-300"
              onClick={onToggleExpand}
            >
              {expanded
                ? messages.canvas.runCollapse
                : messages.canvas.runExpandAll.replace("{count}", String(total))}
            </button>
          ) : null}
        </div>

        <p className="text-[10px] leading-relaxed text-zinc-400 dark:text-zinc-500">
          {messages.canvas.runCostHint}
          {unpriced ? ` ${messages.canvas.runEstimatedPartial}` : ""}
        </p>
      </div>
    </Modal>
  );
}
