"use client";

import type { ReactNode } from "react";
import { PLAYGROUND_PARAM_LABEL_CLASS } from "@/components/playground/playground-styles";

export function PlaygroundSection({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-3 ${className}`.trim()}>
      {title ? (
        <h3 className={PLAYGROUND_PARAM_LABEL_CLASS}>{title}</h3>
      ) : null}
      {children}
    </section>
  );
}
