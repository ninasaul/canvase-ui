"use client";

import { Check } from "@phosphor-icons/react";
import { Icon } from "@/components/ui/icon";

export type CanvasColorOption<T extends string> = {
  value: T;
  label: string;
  color: string;
};

export function CanvasColorPicker<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: ReadonlyArray<CanvasColorOption<T>>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            title={option.label}
            className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${
              selected
                ? "border-white shadow-[0_0_0_1px_rgba(24,24,27,0.18)] dark:border-zinc-900 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.18)]"
                : "border-transparent"
            }`}
            style={{ backgroundColor: option.color }}
            onClick={() => onChange(option.value)}
          >
            {selected ? (
              <Icon icon={Check} size={10} className="text-white" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
