"use client";

import { WarningCircle } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";

export function Alert({
  status = "danger",
  title,
  children,
}: {
  status?: "danger" | "warning" | "success" | "info";
  title?: ReactNode;
  children?: ReactNode;
}) {
  const toneClass =
    status === "danger"
      ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
      : status === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
        : status === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300";

  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${toneClass}`}
    >
      <Icon icon={WarningCircle} size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}
