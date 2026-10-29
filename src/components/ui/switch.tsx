"use client";

import type { ReactNode } from "react";

export type SwitchSize = "mini" | "sm" | "md";

const TRACK_CLASS: Record<SwitchSize, string> = {
  mini: "h-3.5 w-6",
  sm: "h-4 w-7",
  md: "h-5 w-9",
};

const THUMB_CLASS: Record<SwitchSize, string> = {
  mini: "h-2.5 w-2.5",
  sm: "h-3 w-3",
  md: "h-4 w-4",
};

const THUMB_TRANSLATE: Record<SwitchSize, { on: string; off: string }> = {
  mini: { on: "translate-x-3", off: "translate-x-0.5" },
  sm: { on: "translate-x-3.5", off: "translate-x-0.5" },
  md: { on: "translate-x-4.5", off: "translate-x-0.5" },
};

function switchTrackClass(checked: boolean, size: SwitchSize): string {
  return `relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 ease-out ${TRACK_CLASS[size]} ${
    checked
      ? "bg-zinc-900 dark:bg-zinc-100"
      : "bg-zinc-200 dark:bg-zinc-700"
  }`;
}

function switchThumbClass(checked: boolean, size: SwitchSize): string {
  const translate = checked ? THUMB_TRANSLATE[size].on : THUMB_TRANSLATE[size].off;
  return `pointer-events-none inline-block rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.34,1.4,0.64,1)] dark:bg-zinc-950 ${THUMB_CLASS[size]} ${translate}`;
}

export function Switch({
  checked,
  onChange,
  disabled = false,
  label,
  id,
  size = "sm",
  layout = "inline",
  className = "",
}: {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  id?: string;
  size?: SwitchSize;
  /** inline: switch then label; between: label left, switch right (settings row). */
  layout?: "inline" | "between";
  className?: string;
}) {
  const labelId = id ? `${id}-label` : undefined;

  const control = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={label !== undefined ? labelId : undefined}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) {
          onChange?.(!checked);
        }
      }}
      className={`ui-press cursor-pointer ${switchTrackClass(checked, size)} outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100`}
    >
      <span className={switchThumbClass(checked, size)} />
    </button>
  );

  if (label === undefined) {
    return <span className={className}>{control}</span>;
  }

  const labelNode = (
    <span
      id={labelId}
      className={
        layout === "between"
          ? "min-w-0 flex-1 text-xs font-medium text-zinc-500 dark:text-zinc-400"
          : "text-[11px] text-zinc-500 transition-colors duration-150 dark:text-zinc-400"
      }
      onClick={() => {
        if (!disabled) {
          onChange?.(!checked);
        }
      }}
    >
      {label}
    </span>
  );

  if (layout === "between") {
    return (
      <div
        className={`flex w-full items-center justify-between gap-3 select-none ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        } ${className}`.trim()}
      >
        {labelNode}
        {control}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 select-none ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      } ${className}`}
    >
      {control}
      {labelNode}
    </div>
  );
}
