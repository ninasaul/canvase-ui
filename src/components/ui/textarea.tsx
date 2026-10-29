"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";

import {
  FORM_CONTROL_DEFAULT_SIZE,
  type FormControlSize,
} from "@/components/ui/form-control";

export type TextareaVariant = "soft" | "solid" | "plain";
export type TextareaSize = FormControlSize;

const BASE_CLASS =
  "w-full outline-none transition-[color,background-color,border-color,box-shadow] duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60";

const VARIANT_SURFACE_CLASS: Record<TextareaVariant, string> = {
  soft:
    "resize-y border border-zinc-200 bg-zinc-50/80 text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(161,161,170,0.18)] dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:bg-zinc-900 dark:focus:shadow-[0_0_0_3px_rgba(113,113,122,0.28)]",
  solid:
    "resize-y border border-zinc-200 bg-white text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:shadow-[0_0_0_3px_rgba(161,161,170,0.18)] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:shadow-[0_0_0_3px_rgba(113,113,122,0.28)]",
  plain:
    "block resize-none bg-transparent text-zinc-800 leading-[1.65] placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500",
};

const SIZE_CLASS: Record<TextareaSize, string> = {
  mini: "rounded-md px-2 py-1 text-[11px] leading-relaxed",
  xs: "rounded-lg px-2.5 py-1.5 text-xs leading-relaxed",
  sm: "rounded-xl px-3 py-1.5 text-sm leading-relaxed",
  md: "rounded-xl px-3 py-2 text-sm leading-relaxed",
};

const PLAIN_SIZE_CLASS: Record<TextareaSize, string> = {
  mini: "text-[11px]",
  xs: "text-xs",
  sm: "text-sm",
  md: "text-sm",
};

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  variant?: TextareaVariant;
  size?: TextareaSize;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      variant = "soft",
      size = FORM_CONTROL_DEFAULT_SIZE,
      className = "",
      ...props
    },
    reference,
  ) {
    const sizeClass =
      variant === "plain" ? PLAIN_SIZE_CLASS[size] : SIZE_CLASS[size];
    return (
      <textarea
        ref={reference}
        className={`${BASE_CLASS} ${VARIANT_SURFACE_CLASS[variant]} ${sizeClass} ${className}`.trim()}
        {...props}
      />
    );
  },
);
