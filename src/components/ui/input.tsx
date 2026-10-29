"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

import {
  FORM_CONTROL_DEFAULT_SIZE,
  FORM_CONTROL_SIZE,
  formControlClassName,
  type FormControlSize,
} from "@/components/ui/form-control";

export type InputVariant = "soft" | "solid" | "ghost" | "plain";
export type InputSize = FormControlSize;

const BASE_CLASS =
  "w-full outline-none transition-[color,background-color,border-color,box-shadow] duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60";

const VARIANT_SURFACE_CLASS: Record<InputVariant, string> = {
  soft:
    "border border-zinc-200 bg-zinc-50/80 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(161,161,170,0.18)] dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-600 dark:focus:border-zinc-600 dark:focus:bg-zinc-900 dark:focus:shadow-[0_0_0_3px_rgba(113,113,122,0.28)]",
  solid:
    "border border-zinc-200 bg-white placeholder:text-zinc-400 focus:border-zinc-400 focus:shadow-[0_0_0_3px_rgba(161,161,170,0.18)] dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-600 dark:focus:shadow-[0_0_0_3px_rgba(113,113,122,0.28)]",
  ghost:
    "bg-zinc-100 text-zinc-800 placeholder:text-zinc-400 focus:bg-zinc-200/80 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:bg-zinc-800",
  plain:
    "bg-transparent text-zinc-900 placeholder:text-zinc-400 dark:text-zinc-100",
};

const VARIANT_WRAPPER_SURFACE_CLASS: Record<InputVariant, string> = {
  soft:
    "border border-zinc-200 bg-zinc-50/80 focus-within:border-zinc-400 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(161,161,170,0.18)] dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-zinc-600 dark:focus-within:bg-zinc-900 dark:focus-within:shadow-[0_0_0_3px_rgba(113,113,122,0.28)]",
  solid:
    "border border-zinc-200 bg-white focus-within:border-zinc-400 focus-within:shadow-[0_0_0_3px_rgba(161,161,170,0.18)] dark:border-zinc-800 dark:bg-zinc-950 dark:focus-within:shadow-[0_0_0_3px_rgba(113,113,122,0.28)]",
  ghost:
    "bg-zinc-100 text-zinc-800 focus-within:bg-zinc-200/80 dark:bg-zinc-900 dark:text-zinc-100 dark:focus-within:bg-zinc-800",
  plain: "bg-transparent text-zinc-900 dark:text-zinc-100",
};

const FIXED_SIZE_CLASS: Record<InputSize, string> = {
  mini: formControlClassName("mini"),
  xs: formControlClassName("xs"),
  sm: formControlClassName("sm"),
  md: formControlClassName("md"),
};

const GHOST_SIZE_CLASS: Record<InputSize, string> = {
  md: "rounded-lg py-2 pr-3 text-sm",
  sm: "rounded-lg py-2 pr-3 text-xs",
  xs: "rounded-lg py-1.5 pr-2.5 text-xs",
  mini: "rounded-md py-1 pr-2 text-[11px]",
};

const SLOT_SIZE_CLASS: Record<InputSize, string> = {
  mini: `${FORM_CONTROL_SIZE.mini.heightClass} ${FORM_CONTROL_SIZE.mini.radiusClass} ${FORM_CONTROL_SIZE.mini.textClass} gap-1 px-2`,
  xs: `${FORM_CONTROL_SIZE.xs.heightClass} ${FORM_CONTROL_SIZE.xs.radiusClass} ${FORM_CONTROL_SIZE.xs.textClass} gap-1.5 px-2.5`,
  sm: `${FORM_CONTROL_SIZE.sm.heightClass} ${FORM_CONTROL_SIZE.sm.radiusClass} ${FORM_CONTROL_SIZE.sm.textClass} gap-1.5 px-3`,
  md: `${FORM_CONTROL_SIZE.md.heightClass} ${FORM_CONTROL_SIZE.md.radiusClass} ${FORM_CONTROL_SIZE.md.textClass} gap-2 px-3`,
};

/** Admin 默认实心输入样式（兼容旧 inputClassName） */
export const inputClassName = `${BASE_CLASS} ${VARIANT_SURFACE_CLASS.solid} ${FIXED_SIZE_CLASS[FORM_CONTROL_DEFAULT_SIZE]}`;

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  variant?: InputVariant;
  size?: InputSize;
  /** Prefix content shown before the field value (e.g. currency). */
  leading?: ReactNode;
  /** Suffix content shown after the field value (e.g. /sec). */
  trailing?: ReactNode;
  /** Extra classes on the outer wrapper when leading/trailing are used. */
  wrapperClassName?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    variant = "soft",
    size = FORM_CONTROL_DEFAULT_SIZE,
    className = "",
    type = "text",
    leading,
    trailing,
    wrapperClassName = "",
    disabled,
    ...props
  },
  reference,
) {
  const hasSlots = leading != null || trailing != null;

  if (!hasSlots) {
    const sizeClass =
      variant === "ghost"
        ? GHOST_SIZE_CLASS[size]
        : variant === "plain"
          ? ""
          : FIXED_SIZE_CLASS[size];

    return (
      <input
        ref={reference}
        type={type}
        disabled={disabled}
        className={`${BASE_CLASS} ${VARIANT_SURFACE_CLASS[variant]} ${sizeClass} ${className}`.trim()}
        {...props}
      />
    );
  }

  return (
    <div
      className={`flex w-full items-center transition-[color,background-color,border-color,box-shadow] duration-200 ease-out ${VARIANT_WRAPPER_SURFACE_CLASS[variant]} ${SLOT_SIZE_CLASS[size]} ${
        disabled ? "cursor-not-allowed opacity-60" : ""
      } ${wrapperClassName}`.trim()}
    >
      {leading != null ? (
        <span className="shrink-0 text-[13px] font-medium text-zinc-500 tabular-nums dark:text-zinc-400">
          {leading}
        </span>
      ) : null}
      <input
        ref={reference}
        type={type}
        disabled={disabled}
        className={`min-w-0 flex-1 border-0 bg-transparent p-0 outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600 ${className}`.trim()}
        {...props}
      />
      {trailing != null ? (
        <span className="flex shrink-0 items-center text-zinc-400 tabular-nums dark:text-zinc-500">
          {trailing}
        </span>
      ) : null}
    </div>
  );
});
