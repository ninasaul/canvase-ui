import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

import {
  FORM_CONTROL_DEFAULT_SIZE,
  FORM_CONTROL_SIZE,
  formControlClassName,
  type FormControlSize,
} from "@/components/ui/form-control";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "link" | "tertiary";
export type ButtonSize = FormControlSize | "icon" | "icon-sm" | "icon-circle" | "icon-circle-sm";

const BASE_CLASS =
  "ui-press inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 transition-[color,background-color,border-color,opacity,transform,box-shadow] duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "bg-zinc-900 font-medium text-white hover:bg-zinc-800 active:scale-[0.97] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
  secondary:
    "border border-zinc-200 text-zinc-700 hover:bg-zinc-50 active:scale-[0.97] dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900",
  danger:
    "border border-red-200 text-red-600 hover:bg-red-50 active:scale-[0.97] dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40",
  ghost:
    "text-zinc-600 hover:bg-zinc-100 active:scale-[0.97] dark:text-zinc-300 dark:hover:bg-zinc-900",
  tertiary:
    "text-zinc-600 hover:bg-zinc-100 active:scale-[0.97] dark:text-zinc-300 dark:hover:bg-zinc-900",
  link: "h-auto gap-1 px-0 text-xs font-normal text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  mini: formControlClassName("mini"),
  xs: formControlClassName("xs"),
  sm: formControlClassName("sm"),
  md: `${FORM_CONTROL_SIZE.md.heightClass} ${FORM_CONTROL_SIZE.md.radiusClass} ${FORM_CONTROL_SIZE.md.textClass} px-4`,
  icon: "h-9 w-9 gap-0 rounded-md p-0",
  "icon-sm": "h-7 w-7 gap-0 rounded-md p-0",
  "icon-circle": "h-9 w-9 gap-0 rounded-full p-0",
  "icon-circle-sm": "h-7 w-7 gap-0 rounded-full p-0",
};

export type ButtonClassNameOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

/** 供 Link / label 等非 button 元素复用同一套样式 */
export function buttonClassName({
  variant = "primary",
  size = FORM_CONTROL_DEFAULT_SIZE,
  className = "",
}: ButtonClassNameOptions = {}): string {
  const sizeClass = variant === "link" ? "" : SIZE_CLASS[size];
  return `${BASE_CLASS} ${VARIANT_CLASS[variant]} ${sizeClass} ${className}`.trim();
}

export const buttonPrimaryClassName = buttonClassName({ variant: "primary" });
export const buttonSecondaryClassName = buttonClassName({ variant: "secondary" });
export const buttonDangerClassName = buttonClassName({ variant: "danger" });

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = FORM_CONTROL_DEFAULT_SIZE, className = "", type = "button", ...props },
  reference,
) {
  return (
    <button
      ref={reference}
      type={type}
      className={buttonClassName({ variant, size, className })}
      {...props}
    />
  );
});
