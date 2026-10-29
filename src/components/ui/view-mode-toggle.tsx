"use client";

import { List, SquaresFour } from "@phosphor-icons/react";
import { Icon } from "@/components/ui/icon";
import {
  FORM_CONTROL_SIZE,
  type FormControlSize,
} from "@/components/ui/form-control";
import { messages } from "@/messages";

export type ViewMode = "list" | "grid";

export function ViewModeToggle({
  value,
  onChange,
  disabled = false,
  size = "xs",
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  disabled?: boolean;
  /** Match FilterBar select height; default xs (h-8). */
  size?: FormControlSize;
}) {
  const control = FORM_CONTROL_SIZE[size];
  const iconSize = size === "xs" || size === "mini" ? 14 : 16;

  return (
    <div
      role="group"
      aria-label={messages.viewMode.label}
      className={`inline-flex items-stretch border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-800 dark:bg-zinc-900 ${control.heightClass} ${control.radiusClass}`}
    >
      {(
        [
          { mode: "list" as const, icon: List, label: messages.viewMode.list },
          { mode: "grid" as const, icon: SquaresFour, label: messages.viewMode.grid },
        ] as const
      ).map((option) => {
        const active = value === option.mode;
        return (
          <button
            key={option.mode}
            type="button"
            aria-pressed={active}
            aria-label={option.label}
            title={option.label}
            disabled={disabled}
            onClick={() => onChange(option.mode)}
            className={`inline-flex aspect-square h-full items-center justify-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/70 disabled:cursor-not-allowed disabled:opacity-50 ${
              size === "xs" || size === "mini" ? "rounded-md" : control.radiusClass
            } ${
              active
                ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <Icon icon={option.icon} size={iconSize} />
          </button>
        );
      })}
    </div>
  );
}
