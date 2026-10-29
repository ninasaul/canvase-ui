/** Shared control heights so Input / Button / Select stay aligned. */
export const FORM_CONTROL_SIZE = {
  mini: {
    heightClass: "h-7",
    textClass: "text-[11px]",
    radiusClass: "rounded-md",
    paddingClass: "px-2",
  },
  xs: {
    heightClass: "h-8",
    textClass: "text-xs",
    radiusClass: "rounded-lg",
    paddingClass: "px-2.5",
  },
  sm: {
    heightClass: "h-9",
    textClass: "text-sm",
    radiusClass: "rounded-xl",
    paddingClass: "px-3",
  },
  md: {
    heightClass: "h-10",
    textClass: "text-sm",
    radiusClass: "rounded-xl",
    paddingClass: "px-3",
  },
} as const;

export type FormControlSize = keyof typeof FORM_CONTROL_SIZE;

/** Default size for form inputs, selects, and submit buttons. */
export const FORM_CONTROL_DEFAULT_SIZE: FormControlSize = "sm";

export function formControlClassName(
  size: FormControlSize,
  extras: string[] = [],
): string {
  const token = FORM_CONTROL_SIZE[size];
  return [token.heightClass, token.radiusClass, token.paddingClass, token.textClass, ...extras]
    .filter(Boolean)
    .join(" ");
}

export type SelectTriggerVariant = "soft" | "solid";

/** Matches Input soft/solid surfaces; use on Select / DropdownMenu triggers. */
export function selectTriggerClassName(
  variant: SelectTriggerVariant = "soft",
  size: FormControlSize = FORM_CONTROL_DEFAULT_SIZE,
  compact = false,
): string {
  const surface = compact
    ? "border border-zinc-200/80 bg-white hover:border-zinc-300 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
    : variant === "solid"
      ? "border border-zinc-200 bg-white focus:border-zinc-400 focus:shadow-[0_0_0_3px_rgba(161,161,170,0.18)] dark:border-zinc-800 dark:bg-zinc-950 dark:focus:shadow-[0_0_0_3px_rgba(113,113,122,0.28)]"
      : "border border-zinc-200 bg-zinc-50/80 focus:border-zinc-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(161,161,170,0.18)] dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-600 dark:focus:bg-zinc-900 dark:focus:shadow-[0_0_0_3px_rgba(113,113,122,0.28)]";
  return `ui-press flex w-full cursor-pointer items-center justify-between gap-2 ${formControlClassName(size)} text-left text-zinc-900 outline-none transition-[color,background-color,border-color,box-shadow] duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-100 ${surface}`;
}
