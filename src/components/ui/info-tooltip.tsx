"use client";

import { Info } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";

export function InfoTooltip({
  content,
  label,
  children,
  className = "",
}: {
  content: ReactNode;
  label: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Tooltip
      content={content}
      label={label}
      placement="bottom"
      variant="panel"
      className={className}
    >
      {children ?? (
        <button
          type="button"
          aria-label={label}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/70 focus-visible:ring-offset-1 dark:text-zinc-500 dark:hover:text-zinc-300 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-950"
        >
          <Icon icon={Info} size={15} />
        </button>
      )}
    </Tooltip>
  );
}
