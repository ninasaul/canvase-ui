"use client";

import type { ReactNode } from "react";
import { Tooltip } from "@/components/ui/tooltip";

/** Compact hover/focus label for icon-only controls. */
export function IconTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip content={label} label={label} placement="top" variant="compact">
      {children}
    </Tooltip>
  );
}
