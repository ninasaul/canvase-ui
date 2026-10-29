"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react";
import {
  forwardRef,
  type ChangeEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from "react";
import { Icon } from "@/components/ui/icon";
import { Input, type InputSize, type InputVariant } from "@/components/ui/input";

export type SearchProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size" | "type" | "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
  variant?: InputVariant;
  size?: InputSize;
  /** Show clear button when value is non-empty. Default true. */
  clearable?: boolean;
  clearLabel?: string;
  wrapperClassName?: string;
};

export const Search = forwardRef<HTMLInputElement, SearchProps>(function Search(
  {
    value,
    onChange,
    variant = "soft",
    size = "sm",
    clearable = true,
    clearLabel = "Clear",
    wrapperClassName = "",
    className = "",
    disabled,
    onKeyDown,
    ...props
  },
  reference,
) {
  const showClear = clearable && value.length > 0 && !disabled;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
  }

  function handleClear() {
    onChange("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) {
      return;
    }
    if (event.key === "Escape" && value) {
      event.preventDefault();
      event.stopPropagation();
      onChange("");
    }
  }

  const iconSize = size === "mini" ? 12 : size === "xs" ? 13 : 14;
  const clearButtonClass =
    size === "mini"
      ? "inline-flex h-4 w-4 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      : "inline-flex h-5 w-5 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200";

  return (
    <Input
      ref={reference}
      type="search"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      variant={variant}
      size={size}
      className={`[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden ${className}`.trim()}
      wrapperClassName={wrapperClassName}
      leading={
        <Icon icon={MagnifyingGlass} size={iconSize} className="text-zinc-400" />
      }
      trailing={
        showClear ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label={clearLabel}
            className={clearButtonClass}
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleClear}
          >
            <Icon icon={X} size={size === "mini" ? 10 : 12} />
          </button>
        ) : undefined
      }
      {...props}
    />
  );
});
