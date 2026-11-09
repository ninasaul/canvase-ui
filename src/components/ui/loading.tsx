"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Small, dependency-free loading indicator.
 *
 * Inspired by vue-smart-loading-kit's `<Spinner>` (MIT), rebuilt for this app:
 * one component, a few compositor-friendly variants, and CSS variables so a
 * caller only sets numbers. Everything is inline SVG/CSS — no images, no
 * measure passes, no layout.
 */

export type LoadingVariant =
  | "arc"
  | "ring"
  | "dots"
  | "pulse"
  | "bars"
  | "orbit"
  | "ripple";

export type LoadingProps = {
  variant?: LoadingVariant;
  /** Box size in px (the indicator fits inside). */
  size?: number;
  /** Any CSS colour; defaults to `currentColor`. */
  color?: string;
  /** Multiplier on the base duration: 2 = twice as slow. */
  speed?: number;
  /** Stroke width for arc/ring, in px. */
  thickness?: number;
  /** Show the faint track behind arc/ring. */
  track?: boolean;
  /** Screen-reader label; hidden visually. */
  label?: string;
  className?: string;
};

/** Reduced motion keeps a slow hint of movement instead of freezing. */
const REDUCED_MOTION_FACTOR = 2;

export function Loading({
  variant = "arc",
  size = 24,
  color = "currentColor",
  speed = 1,
  thickness = 2.5,
  track = true,
  label,
  className = "",
}: LoadingProps) {
  const reduceMotion = usePrefersReducedMotion();
  const scale = reduceMotion ? REDUCED_MOTION_FACTOR : 1;
  const duration = clamp(0.9 * speed * scale, 0.3, 8);

  const style = {
    "--loading-size": `${size}px`,
    // `currentColor` must stay inherited: writing it into a variable makes the
    // colour resolve to itself and the loader renders near-black.
    ...(color === "currentColor" ? {} : { "--loading-color": color }),
    "--loading-thickness": `${thickness}px`,
    "--loading-duration": `${duration}s`,
    ...(track ? {} : { "--loading-track": "transparent" }),
  } as React.CSSProperties;

  return (
    <span
      className={`ui-loading ui-loading--${variant} ${className}`.trim()}
      style={style}
      role="status"
      aria-live="polite"
    >
      <span className="ui-loading__shape" aria-hidden />
      <span className="sr-only">{label ?? "Loading"}</span>
    </span>
  );
}

/** Matches `prefers-reduced-motion` without a media-query flash on mount. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  const queryRef = useRef<MediaQueryList | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    queryRef.current = query;
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
