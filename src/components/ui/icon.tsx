"use client";

import type {
  Icon as PhosphorIconComponent,
  IconProps,
  IconWeight,
} from "@phosphor-icons/react";

export type AppIconData = PhosphorIconComponent;

export function Icon({
  icon: Glyph,
  size = 16,
  weight = "regular",
  className,
}: {
  icon: AppIconData;
  size?: number;
  weight?: IconWeight;
  className?: string;
  /** Kept for call-site compatibility; Phosphor uses `weight` instead. */
  strokeWidth?: number;
}) {
  return (
    <Glyph
      size={size}
      weight={weight}
      color="currentColor"
      className={className}
      aria-hidden={true}
    />
  );
}

export type { IconProps, IconWeight };
