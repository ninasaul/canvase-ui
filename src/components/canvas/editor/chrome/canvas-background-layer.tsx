"use client";

import { useStoreApi } from "@xyflow/react";
import { useEffect, useId, useRef } from "react";

import type { CanvasBackgroundKind } from "@/lib/canvas/canvas-preferences";

type ViewportTransform = readonly [number, number, number];

type PatternGeometry = {
  width: number;
  height: number;
  x: number;
  y: number;
  radius: number;
  path: string;
  strokeWidth: number;
};

function patternGeometry(
  kind: Exclude<CanvasBackgroundKind, "none">,
  gap: number,
  size: number,
  transform: ViewportTransform,
): PatternGeometry {
  const [x, y, zoom] = transform;
  const scaledGap = Math.max(gap * zoom, 1);
  const scaledSize = Math.max(size * zoom, kind === "dots" ? 0.5 : 1);
  const centre = scaledSize / 2;
  return {
    width: scaledGap,
    height: scaledGap,
    x: x % scaledGap,
    y: y % scaledGap,
    radius: centre,
    path:
      kind === "cross"
        ? `M${centre} 0 V${scaledSize} M0 ${centre} H${scaledSize}`
        : `M0 ${centre} H${scaledGap}`,
    strokeWidth: Math.max(scaledSize, 1),
  };
}

/**
 * Canvas dot / line / cross pattern.
 *
 * xyflow's `<Background>` subscribes to the viewport transform in React, so a
 * pan or zoom re-renders it once per frame (measured: one React commit per pan
 * frame, ~120 pattern mutations per 60-frame gesture). This version renders the
 * pattern once and moves it by writing SVG attributes from a store
 * subscription — no React work while the viewport moves.
 */
export function CanvasBackgroundLayer({
  kind,
  gap,
  size,
  color,
}: {
  kind: Exclude<CanvasBackgroundKind, "none">;
  /** Grid cell size in flow units. */
  gap: number;
  /** Dot diameter / cross arm size in flow units. */
  size: number;
  color: string;
}) {
  const storeApi = useStoreApi();
  const reactId = useId();
  const patternId = `canvas-bg-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const patternRef = useRef<SVGPatternElement | null>(null);
  const dotRef = useRef<SVGCircleElement | null>(null);
  const lineRef = useRef<SVGPathElement | null>(null);
  // Initial geometry comes from the live transform: the component only renders
  // on mount or when the appearance preferences change.
  const initial = patternGeometry(
    kind,
    gap,
    size,
    storeApi.getState().transform,
  );

  useEffect(() => {
    const pattern = patternRef.current;
    const dot = dotRef.current;
    const line = lineRef.current;
    if (!pattern) {
      return;
    }

    // Pan only changes the pattern origin; write just the attributes that
    // actually changed so a translation costs two attribute writes, not seven.
    let previous: PatternGeometry | null = null;
    const setAttr = (element: Element, name: string, value: string | number) => {
      const text = String(value);
      if (element.getAttribute(name) !== text) {
        element.setAttribute(name, text);
      }
    };
    const apply = (transform: ViewportTransform) => {
      const next = patternGeometry(kind, gap, size, transform);
      setAttr(pattern, "x", next.x);
      setAttr(pattern, "y", next.y);
      if (
        !previous ||
        previous.width !== next.width ||
        previous.height !== next.height
      ) {
        setAttr(pattern, "width", next.width);
        setAttr(pattern, "height", next.height);
      }
      if (dot) {
        setAttr(dot, "r", next.radius);
        setAttr(dot, "cx", next.radius);
        setAttr(dot, "cy", next.radius);
      }
      if (
        line &&
        (!previous ||
          previous.path !== next.path ||
          previous.strokeWidth !== next.strokeWidth)
      ) {
        setAttr(line, "d", next.path);
        setAttr(line, "stroke-width", next.strokeWidth);
      }
      previous = next;
    };

    apply(storeApi.getState().transform);
    return storeApi.subscribe((state, previous) => {
      if (state.transform === previous.transform) {
        return;
      }
      apply(state.transform);
    });
  }, [gap, kind, size, storeApi]);

  return (
    <svg
      aria-hidden
      className="react-flow__background pointer-events-none absolute inset-0 h-full w-full"
      data-testid="rf__background"
    >
      <pattern
        ref={patternRef}
        id={patternId}
        width={initial.width}
        height={initial.height}
        x={initial.x}
        y={initial.y}
        patternUnits="userSpaceOnUse"
      >
        {kind === "dots" ? (
          <circle
            ref={dotRef}
            cx={initial.radius}
            cy={initial.radius}
            r={initial.radius}
            fill={color}
          />
        ) : (
          <path
            ref={lineRef}
            d={initial.path}
            stroke={color}
            strokeWidth={initial.strokeWidth}
            fill="none"
          />
        )}
      </pattern>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
