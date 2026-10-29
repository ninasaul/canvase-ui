"use client";

import type { LabelHTMLAttributes, ReactNode } from "react";

export type FieldProps = {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
};

const DEFAULT_LABEL_CLASS = "text-xs font-medium text-zinc-500";

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className = "",
  labelClassName = DEFAULT_LABEL_CLASS,
}: FieldProps) {
  return (
    <div className={`space-y-1 ${className}`.trim()}>
      <label htmlFor={htmlFor} className={labelClassName}>
        {label}
      </label>
      {children}
      {hint ? <div>{hint}</div> : null}
    </div>
  );
}

export type FieldLabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  children: ReactNode;
};

/** 用于外层已是 label 包裹控件的场景 */
export function FieldLabel({
  children,
  className = "block space-y-1 text-xs text-zinc-500",
  ...props
}: FieldLabelProps) {
  return (
    <label className={className} {...props}>
      {children}
    </label>
  );
}
