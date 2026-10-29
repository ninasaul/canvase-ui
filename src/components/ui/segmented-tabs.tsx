"use client";

import { useCallback, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export type SegmentedTabOption<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
};

type SegmentedTabsProps<T extends string> = {
  value: T;
  options: SegmentedTabOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  size?: "mini" | "xs" | "sm" | "md";
  /** Stretch tabs equally across the tablist width. */
  fullWidth?: boolean;
  disabled?: boolean;
  /** Optional stable id for tablist / tab / tabpanel wiring. */
  id?: string;
  "aria-label"?: string;
};

const SIZE_CLASS = {
  mini: "px-1.5 py-0.5 text-[11px]",
  xs: "px-2 py-1 text-[11px]",
  sm: "px-3 py-1.5 text-xs",
  md: "px-3.5 py-2 text-sm",
} as const;

function isOptionEnabled<T extends string>(
  option: SegmentedTabOption<T>,
  tabsDisabled: boolean | undefined,
): boolean {
  return !tabsDisabled && !option.disabled;
}

export function SegmentedTabs<T extends string>({
  value,
  options,
  onChange,
  className = "",
  size = "sm",
  fullWidth = false,
  disabled = false,
  id,
  "aria-label": ariaLabel,
}: SegmentedTabsProps<T>) {
  const generatedId = useId();
  const listId = id ?? generatedId;
  const indicatorLayoutId = `${listId}-indicator`;
  const reduceMotion = useReducedMotion();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const enabledIndexes = options
    .map((option, index) => (isOptionEnabled(option, disabled) ? index : -1))
    .filter((index) => index >= 0);

  const activeIndex = options.findIndex((option) => option.value === value);
  const focusableIndex =
    activeIndex >= 0 && options[activeIndex] && isOptionEnabled(options[activeIndex], disabled)
      ? activeIndex
      : (enabledIndexes[0] ?? -1);

  const focusTabAt = useCallback((index: number) => {
    const button = tabRefs.current[index];
    button?.focus();
  }, []);

  const selectEnabledAt = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option || !isOptionEnabled(option, disabled)) {
        return;
      }
      onChange(option.value);
      focusTabAt(index);
    },
    [disabled, focusTabAt, onChange, options],
  );

  const moveSelection = useCallback(
    (currentIndex: number, direction: 1 | -1) => {
      if (enabledIndexes.length === 0) {
        return;
      }
      const position = enabledIndexes.indexOf(currentIndex);
      const start = position >= 0 ? position : 0;
      const nextPosition = (start + direction + enabledIndexes.length) % enabledIndexes.length;
      const nextIndex = enabledIndexes[nextPosition];
      if (nextIndex === undefined) {
        return;
      }
      selectEnabledAt(nextIndex);
    },
    [enabledIndexes, selectEnabledAt],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown": {
          event.preventDefault();
          moveSelection(currentIndex, 1);
          break;
        }
        case "ArrowLeft":
        case "ArrowUp": {
          event.preventDefault();
          moveSelection(currentIndex, -1);
          break;
        }
        case "Home": {
          event.preventDefault();
          const first = enabledIndexes[0];
          if (first !== undefined) {
            selectEnabledAt(first);
          }
          break;
        }
        case "End": {
          event.preventDefault();
          const last = enabledIndexes[enabledIndexes.length - 1];
          if (last !== undefined) {
            selectEnabledAt(last);
          }
          break;
        }
        default:
          break;
      }
    },
    [enabledIndexes, moveSelection, selectEnabledAt],
  );

  return (
    <div
      id={listId}
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className={`flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900 ${
        fullWidth ? "w-full min-w-0" : ""
      } ${className}`.trim()}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        const optionDisabled = !isOptionEnabled(option, disabled);
        const tabId = `${listId}-${option.value}`;

        return (
          <button
            key={option.value}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            id={tabId}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`${listId}-panel-${option.value}`}
            aria-disabled={optionDisabled || undefined}
            disabled={optionDisabled}
            tabIndex={index === focusableIndex ? 0 : -1}
            onClick={() => {
              if (optionDisabled) {
                return;
              }
              onChange(option.value);
            }}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`relative inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg transition-[color,transform] duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-100 active:scale-[0.98] dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-900 ${
              SIZE_CLASS[size]
            } ${fullWidth ? "flex-1" : ""} ${
              optionDisabled
                ? "cursor-not-allowed text-zinc-400 opacity-50 active:scale-100 dark:text-zinc-600"
                : active
                  ? "text-zinc-900 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            {active ? (
              <motion.span
                layoutId={reduceMotion ? undefined : indicatorLayoutId}
                className="absolute inset-0 rounded-lg bg-white shadow-sm dark:bg-zinc-800"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 32, mass: 0.7 }
                }
                aria-hidden
              />
            ) : null}
            {option.icon ? (
              <span className="relative z-10 inline-flex shrink-0">{option.icon}</span>
            ) : null}
            <span className="relative z-10 min-w-0 truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
