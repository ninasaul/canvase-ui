"use client";

import { forwardRef, type ReactNode } from "react";

export type CheckboxSize = "mini" | "sm" | "md";

const BOX_CLASS: Record<CheckboxSize, string> = {
  mini: "h-3.5 w-3.5 rounded-[4px]",
  sm: "h-4 w-4 rounded-[5px]",
  md: "h-[18px] w-[18px] rounded-md",
};

const ICON_SIZE: Record<CheckboxSize, number> = {
  mini: 9,
  sm: 10,
  md: 12,
};

function boxSurfaceClass(checked: boolean, indeterminate: boolean): string {
  if (checked || indeterminate) {
    return "border-zinc-900 bg-zinc-900 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";
  }
  return "border-zinc-300 bg-white hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:hover:border-zinc-500";
}

function CheckMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className="origin-center animate-[ui-check-in_140ms_var(--ui-ease-out)_both]"
    >
      <path
        d="M2.2 6.2 4.7 8.6 9.8 3.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IndeterminateMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className="origin-center animate-[ui-check-in_140ms_var(--ui-ease-out)_both]"
    >
      <path
        d="M2.5 6h7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export type CheckboxProps = {
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  id?: string;
  size?: CheckboxSize;
  className?: string;
  "aria-label"?: string;
};

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  function Checkbox(
    {
      checked = false,
      indeterminate = false,
      onChange,
      disabled = false,
      label,
      id,
      size = "sm",
      className = "",
      "aria-label": ariaLabel,
    },
    reference,
  ) {
    const mixed = indeterminate && !checked;
    const labelId = id ? `${id}-label` : undefined;

    const control = (
      <button
        ref={reference}
        id={id}
        type="button"
        role="checkbox"
        aria-checked={mixed ? "mixed" : checked}
        aria-label={ariaLabel}
        aria-labelledby={label !== undefined ? labelId : undefined}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled) {
            onChange?.(mixed ? true : !checked);
          }
        }}
        className={`ui-press inline-flex shrink-0 items-center justify-center border transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/45 focus-visible:ring-offset-2 active:scale-[0.94] disabled:opacity-40 disabled:active:scale-100 ${BOX_CLASS[size]} ${boxSurfaceClass(checked, mixed)}`}
      >
        {checked ? <CheckMark size={ICON_SIZE[size]} /> : null}
        {mixed ? <IndeterminateMark size={ICON_SIZE[size]} /> : null}
      </button>
    );

    if (label === undefined) {
      return <span className={`inline-flex ${className}`.trim()}>{control}</span>;
    }

    return (
      <div
        className={`inline-flex items-center gap-2 select-none ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        } ${className}`.trim()}
      >
        {control}
        <span
          id={labelId}
          className="text-sm text-zinc-700 dark:text-zinc-300"
          onClick={() => {
            if (!disabled) {
              onChange?.(mixed ? true : !checked);
            }
          }}
        >
          {label}
        </span>
      </div>
    );
  },
);
