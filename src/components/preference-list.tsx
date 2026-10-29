"use client";

import type { ReactNode } from "react";
import { Surface } from "@/components/ui/surface";

export function PreferenceGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <h2 className="px-1 text-[11px] font-medium tracking-[0.08em] text-zinc-400 uppercase">
        {title}
      </h2>
      <Surface className="overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-900">
        {children}
      </Surface>
    </div>
  );
}

export function PreferenceRow({
  label,
  hint,
  children,
  align = "center",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div
      className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:justify-between sm:gap-8 sm:px-5 ${
        align === "start" ? "sm:items-start" : "sm:items-center"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {label}
        </p>
        {hint ? (
          <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {hint}
          </p>
        ) : null}
      </div>
      <div className="w-full min-w-0 sm:w-80 sm:max-w-80 sm:shrink-0">
        {children}
      </div>
    </div>
  );
}

/** Hide FormField/SelectField chrome labels — PreferenceRow already shows them. */
export function PreferenceControl({ children }: { children: ReactNode }) {
  return <div className="[&>div>label]:sr-only">{children}</div>;
}
