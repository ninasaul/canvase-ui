"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";

export type OptionRadioItem = {
  value: string;
  label: string;
  icon?: ReactNode;
};

type GridColumns = 2 | 3 | 4;

type OptionRadioGroupProps = {
  id?: string;
  value: string;
  options: OptionRadioItem[];
  onChange: (value: string) => void;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
  layout?: "wrap" | "grid";
  /** Grid columns when layout is grid. `auto` fills by container width. */
  columns?: GridColumns | "auto";
};

const GRID_COLS_CLASS: Record<GridColumns, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

function minCellWidthPx(options: OptionRadioItem[]): number {
  const hasIcons = options.some((option) => option.icon);
  const maxLabelLen = Math.max(...options.map((option) => option.label.length), 1);

  if (hasIcons) {
    return 92;
  }
  if (maxLabelLen > 8) {
    return 84;
  }
  if (maxLabelLen > 5) {
    return 76;
  }
  return 68;
}

function optionButtonClass(selected: boolean, isGrid: boolean, hasIcon: boolean): string {
  return [
    "inline-flex items-center justify-center gap-1.5 rounded-md border text-xs",
    "transition-[color,background-color,border-color] duration-150 outline-none",
    "focus-visible:ring-2 focus-visible:ring-zinc-400/70 focus-visible:ring-offset-1",
    "disabled:cursor-not-allowed disabled:opacity-50",
    isGrid ? "w-full min-w-0" : "",
    hasIcon ? "px-2 py-1.5" : "px-2.5 py-1.5",
    selected
      ? "border-zinc-900 bg-zinc-900 font-medium text-zinc-50 dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900"
      : "border-zinc-200 bg-white font-normal text-zinc-500 hover:border-zinc-300 hover:text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200",
  ]
    .filter(Boolean)
    .join(" ");
}

export function OptionRadioGroup({
  id,
  value,
  options,
  onChange,
  disabled = false,
  "aria-label": ariaLabel,
  className = "",
  layout = "wrap",
  columns = "auto",
}: OptionRadioGroupProps) {
  const isGrid = layout === "grid";

  const gridStyle = useMemo((): CSSProperties | undefined => {
    if (!isGrid || columns !== "auto") {
      return undefined;
    }
    const minPx = minCellWidthPx(options);
    return {
      gridTemplateColumns: `repeat(auto-fill, minmax(${minPx}px, 1fr))`,
    };
  }, [columns, isGrid, options]);

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={ariaLabel}
      style={gridStyle}
      className={`${
        isGrid
          ? `grid gap-1.5 ${columns === "auto" ? "" : GRID_COLS_CLASS[columns]}`
          : "flex flex-wrap gap-1.5"
      } ${className}`.trim()}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const hasIcon = Boolean(option.icon);

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={optionButtonClass(selected, isGrid, hasIcon)}
          >
            {hasIcon ? (
              <span
                className={`inline-flex shrink-0 ${
                  selected
                    ? "text-zinc-200 dark:text-zinc-700"
                    : "text-zinc-400 dark:text-zinc-500"
                }`}
              >
                {option.icon}
              </span>
            ) : null}
            <span className={`min-w-0 ${isGrid ? "truncate" : ""}`}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
