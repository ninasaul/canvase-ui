import type { CanvasNodeStyle } from "@/lib/canvas/canvas-preferences";

export const NODE_STYLE_CLASS: Record<CanvasNodeStyle, string> = {
  card: "rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900",
  soft: "rounded-xl border border-transparent bg-zinc-100/80 dark:bg-zinc-800/70",
  outline:
    "rounded-lg border-[1.5px] border-zinc-300 bg-white/95 dark:border-zinc-600 dark:bg-zinc-900",
  glass:
    "rounded-xl border border-white/55 bg-white/65 backdrop-blur-md dark:border-zinc-700/60 dark:bg-zinc-900/55",
};

export const NODE_STYLE_HOVER_CLASS: Record<CanvasNodeStyle, string> = {
  card: "hover:border-sky-400/70 hover:shadow-[0_3px_16px_-8px_rgba(56,189,248,0.45)] dark:hover:border-sky-400/60 dark:hover:shadow-[0_4px_18px_-8px_rgba(56,189,248,0.35)]",
  soft: "hover:border-sky-400/60 hover:bg-zinc-200/75 dark:hover:border-sky-400/50 dark:hover:bg-zinc-800",
  outline:
    "hover:border-sky-400 hover:shadow-[0_3px_14px_-8px_rgba(56,189,248,0.4)] dark:hover:border-sky-400/70",
  glass:
    "hover:border-sky-300/70 hover:bg-white/75 dark:hover:border-sky-400/60 dark:hover:bg-zinc-900/65",
};

/**
 * Group containers: same radius/border language as nodes, translucent fill so
 * nested media nodes stay visually primary.
 */
export const GROUP_STYLE_CLASS: Record<CanvasNodeStyle, string> = {
  card: "rounded-lg border border-zinc-200/85 bg-zinc-50/45 dark:border-zinc-700/75 dark:bg-zinc-950/35",
  soft: "rounded-xl border border-transparent bg-zinc-100/40 dark:bg-zinc-800/35",
  outline:
    "rounded-lg border-[1.5px] border-zinc-300/75 bg-white/35 dark:border-zinc-600/70 dark:bg-zinc-950/30",
  glass:
    "rounded-xl border border-white/45 bg-white/30 backdrop-blur-md dark:border-zinc-700/45 dark:bg-zinc-950/30",
};

export const GROUP_STYLE_HOVER_CLASS: Record<CanvasNodeStyle, string> = {
  card: "hover:border-sky-400/65 hover:bg-zinc-50/60 dark:hover:border-sky-400/55 dark:hover:bg-zinc-950/45",
  soft: "hover:border-sky-400/55 hover:bg-zinc-100/55 dark:hover:border-sky-400/45 dark:hover:bg-zinc-800/45",
  outline:
    "hover:border-sky-400/80 hover:bg-white/45 dark:hover:border-sky-400/60 dark:hover:bg-zinc-950/40",
  glass:
    "hover:border-sky-300/65 hover:bg-white/40 dark:hover:border-sky-400/55 dark:hover:bg-zinc-950/40",
};

/** Selected border — matches NodeShell. */
export const NODE_SELECTED_CLASS =
  "!border-sky-500 dark:!border-sky-400";

/** Snap / drag-over ring — matches NodeShell snapTarget. */
export const NODE_SNAP_RING_CLASS =
  "ring-2 ring-sky-400 ring-offset-2 ring-offset-zinc-50 dark:ring-sky-500 dark:ring-offset-zinc-950";
