"use client";

import { Database } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { Icon, type AppIconData } from "@/components/ui/icon";

export type EmptySize = "default" | "compact" | "inline";

const SIZE_CLASS: Record<
  EmptySize,
  { root: string; icon: number; text: string; layout: "column" | "row" }
> = {
  default: {
    root: "px-4 py-10",
    icon: 32,
    text: "text-sm text-zinc-500 dark:text-zinc-400",
    layout: "column",
  },
  compact: {
    root: "px-4 py-6",
    icon: 24,
    text: "text-sm text-zinc-500 dark:text-zinc-400",
    layout: "column",
  },
  inline: {
    root: "px-2.5 py-2",
    icon: 14,
    text: "text-xs text-zinc-400",
    layout: "row",
  },
};

export function Empty({
  icon = Database,
  children,
  size = "default",
  className = "",
}: {
  icon?: AppIconData;
  children: ReactNode;
  size?: EmptySize;
  className?: string;
}) {
  const sizeConfig = SIZE_CLASS[size];
  const layoutClass =
    sizeConfig.layout === "row"
      ? "flex items-center gap-2"
      : "flex flex-col items-center justify-center gap-2 text-center";

  return (
    <div
      className={`${layoutClass} ${sizeConfig.root} ${className}`.trim()}
      role="status"
    >
      <Icon
        icon={icon}
        size={sizeConfig.icon}
        weight="duotone"
        className="shrink-0 text-zinc-300 dark:text-zinc-600"
      />
      <div className={sizeConfig.text}>{children}</div>
    </div>
  );
}
