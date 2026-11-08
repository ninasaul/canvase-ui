import { selectTriggerClassName } from "@/components/ui/form-control";

/** Shared column width for message list + composer (chat / image / video). */
export const PLAYGROUND_CHAT_CONTENT_CLASS = "mx-auto w-full max-w-5xl";

/** Horizontal gutter outside the shared content column. */
export const PLAYGROUND_CONTENT_GUTTER_CLASS = "px-4 sm:px-5";

/** Vertical padding for the scrollable message list. */
export const PLAYGROUND_LIST_PAD_CLASS = "pt-5 pb-32 sm:pt-6 sm:pb-36";

/** Bottom padding for the composer dock (all modes). */
export const PLAYGROUND_COMPOSER_PAD_CLASS = "pb-4 sm:pb-5";

/** Horizontal + bottom padding for the composer dock. */
export const PLAYGROUND_COMPOSER_DOCK_CLASS =
  `${PLAYGROUND_CONTENT_GUTTER_CLASS} ${PLAYGROUND_COMPOSER_PAD_CLASS} shrink-0`;

/** Scroll list chrome: gutter + vertical pad. */
export const PLAYGROUND_LIST_DOCK_CLASS =
  `${PLAYGROUND_CONTENT_GUTTER_CLASS} ${PLAYGROUND_LIST_PAD_CLASS}`;

/** Circular icon button for send / generate / stop actions. */
export const PLAYGROUND_CIRCLE_ACTION_CLASS = "shrink-0";
export const PLAYGROUND_CIRCLE_ACTION_SIZE = "icon-circle" as const;
export const PLAYGROUND_CIRCLE_ACTION_SM_SIZE = "icon-circle-sm" as const;

/** Composer toolbar icon actions (@ / attach / settings) — same radius as selects. */
export const PLAYGROUND_COMPOSER_TOOLBAR_ICON_CLASS = "shrink-0 !rounded-lg";
export const PLAYGROUND_COMPOSER_TOOLBAR_ICON_SIZE = "icon-sm" as const;

/**
 * Composer footer: stack on narrow screens so mode/model/params do not
 * crush hint + generate into one overflowing row.
 */
export const PLAYGROUND_COMPOSER_TOOLBAR_CLASS =
  "flex flex-col gap-1.5 px-2 pb-2 pt-1 sm:flex-row sm:items-center sm:gap-1.5";

/** Horizontally scrollable leading controls (mode / model / param pill). */
export const PLAYGROUND_COMPOSER_TOOLBAR_LEADING_CLASS =
  "flex min-w-0 items-center gap-1.5 overflow-x-auto overscroll-x-contain scrollbar-none";

/**
 * Horizontal inset for composer field rows (e.g. refs + textarea).
 * Keep pr-0 on this row — parent padding-right pulls the whole textarea off the shell edge.
 */
export const PLAYGROUND_COMPOSER_FIELD_INSET_CLASS = "pl-3 pr-0";

/**
 * Composer textarea padding. Right pad lives on the textarea itself so text does not
 * kiss the scrollbar; the element still spans to the shell edge so the scrollbar stays flush.
 */
export const PLAYGROUND_COMPOSER_TEXTAREA_PAD_CLASS = "pl-3 pr-3 pt-3 pb-2";

/** Prompt composer shell (image / video) — standalone card surface. */
export const PLAYGROUND_COMPOSER_SHELL_CLASS =
  "rounded-xl border border-zinc-200 bg-zinc-50/80 transition-[color,background-color,border-color,box-shadow] duration-200 ease-out dark:border-zinc-800 dark:bg-zinc-900/60";

/**
 * Composer chrome when already inside another surface (e.g. canvas node dock).
 * Avoids a second card/border stack.
 */
export const PLAYGROUND_COMPOSER_SHELL_PLAIN_CLASS =
  "bg-transparent transition-[color,background-color,border-color] duration-200 ease-out";

/**
 * Floating generation dock surface (node-attached or canvas-bottom).
 * Soft lift + blur so the prompt panel reads as an overlay, not a flat bar.
 */
export const CANVAS_GENERATION_FLOAT_SURFACE_CLASS =
  "rounded-2xl border border-zinc-200/70 bg-white/90 shadow-[0_18px_50px_-20px_rgba(24,24,27,0.45)] ring-1 ring-zinc-950/5 backdrop-blur-xl dark:border-zinc-700/70 dark:bg-zinc-950/90 dark:shadow-[0_18px_50px_-18px_rgba(0,0,0,0.75)] dark:ring-white/10";

/**
 * Bottom-docked variant: the panel is pinned to the canvas edge rather than
 * floating over content, so it takes a flat surface with a top edge instead of
 * a large drop shadow.
 */
export const CANVAS_GENERATION_BOTTOM_SURFACE_CLASS =
  "rounded-t-2xl border border-b-0 border-zinc-200/80 bg-white dark:border-zinc-700/80 dark:bg-zinc-950";

export type PlaygroundComposerSurface = "card" | "plain";

export function playgroundComposerShellClass(
  surface: PlaygroundComposerSurface = "card",
): string {
  return surface === "plain"
    ? PLAYGROUND_COMPOSER_SHELL_PLAIN_CLASS
    : PLAYGROUND_COMPOSER_SHELL_CLASS;
}

/** Parameter field labels (size, ratio, count, etc.). */
export const PLAYGROUND_PARAM_LABEL_CLASS =
  "text-xs font-medium text-zinc-500 dark:text-zinc-400";

/** Model family badge in parameter panels. */
export const PLAYGROUND_FAMILY_BADGE_CLASS =
  "rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

/** Standalone parameter panel surface (non-embedded). */
export const PLAYGROUND_PARAM_SURFACE_CLASS =
  "border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30";

/** Parameter fields stack vertically; pill groups use inner grid via OptionRadioGroup. */
export const PLAYGROUND_PARAM_GRID_CLASS = "grid grid-cols-1 gap-4";

/** Preview column surface (solid, no checkerboard). */
export const PLAYGROUND_PREVIEW_COLUMN_CLASS =
  "bg-zinc-50 dark:bg-zinc-950";

/** Media stage chrome — solid fill; frame hugs intrinsic media aspect ratio. */
export const PLAYGROUND_PREVIEW_STAGE_CLASS =
  "bg-zinc-100 dark:bg-zinc-900";

/** Empty / loading placeholder frame on the preview canvas. */
export const PLAYGROUND_PREVIEW_FRAME_CLASS =
  "rounded-xl border border-dashed border-zinc-300/80 bg-white dark:border-zinc-700/80 dark:bg-zinc-900/60";

/** Toolbar Select triggers — compact, aligned with global form controls. */
export const PLAYGROUND_TOOLBAR_SELECT_TRIGGER = selectTriggerClassName(
  "soft",
  "xs",
  true,
);

/**
 * Composer toolbar pill (param summary / compact selects).
 * Radius matches toolbar model Select (`rounded-lg`), not capsule pills.
 */
export const PLAYGROUND_COMPOSER_PILL_CLASS =
  "ui-press inline-flex h-8 max-w-full shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-left text-xs text-zinc-700 outline-none transition-[color,background-color,border-color,transform] duration-150 ease-out hover:border-zinc-300 hover:bg-zinc-100 hover:shadow-sm active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800";

