"use client";

import { useCallback, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export type TabOption<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
};

type TabsProps<T extends string> = {
  value: T;
  options: TabOption<T>[];
  onChange: (value: T) => void;
  endContent?: ReactNode;
  className?: string;
  size?: "mini" | "xs" | "sm" | "md";
  /** Stretch tabs equally across the tablist width. */
  fullWidth?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
};

const SIZE_CLASS = {
  mini: "h-7 px-2 text-[11px]",
  xs: "h-8 px-2.5 text-[11px]",
  sm: "h-9 px-3.5 text-sm",
  md: "h-10 px-4 text-sm",
} as const;

function isOptionEnabled<T extends string>(
  option: TabOption<T>,
  tabsDisabled: boolean | undefined,
): boolean {
  return !tabsDisabled && !option.disabled;
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
  endContent,
  className = "",
  size = "sm",
  fullWidth = false,
  disabled = false,
  "aria-label": ariaLabel,
}: TabsProps<T>) {
  const listId = useId();
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

  const gapClass = fullWidth ? "gap-0" : "gap-1";

  return (
    <div
      className={`flex flex-col gap-2 border-b border-zinc-200 dark:border-zinc-800 sm:flex-row sm:items-end sm:justify-between ${
        fullWidth || endContent ? "w-full min-w-0" : ""
      } ${className}`.trim()}
    >
      <div
        id={listId}
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        className={`relative flex ${gapClass} min-w-0 ${
          fullWidth ? "w-full flex-1" : ""
        }`}
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
              className={`relative inline-flex min-w-0 items-center justify-center gap-1.5 font-medium transition-colors duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-950 ${
                SIZE_CLASS[size]
              } ${
                // On PC, page tabs should not be equally divided by default.
                // On smaller screens, we keep `flex-1` to make them easier to tap.
                fullWidth ? "flex-1 md:flex-none" : ""
              } ${
                optionDisabled
                  ? "cursor-not-allowed text-zinc-400 opacity-50 dark:text-zinc-600"
                  : active
                    ? "text-zinc-950 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              } leading-none`}
            >
              {option.icon ? (
                <span className="relative z-10 inline-flex shrink-0">{option.icon}</span>
              ) : null}
              <span className="relative z-10 min-w-0 truncate">{option.label}</span>
              {active ? (
                <motion.span
                  layoutId={reduceMotion ? undefined : indicatorLayoutId}
                  className="absolute inset-x-0 bottom-0 z-10 h-0.5 bg-zinc-950 dark:bg-zinc-50"
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 420, damping: 32, mass: 0.7 }
                  }
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>
      {endContent ? (
        <div className="flex shrink-0 items-end gap-2 sm:justify-end">{endContent}</div>
      ) : null}
    </div>
  );
}
