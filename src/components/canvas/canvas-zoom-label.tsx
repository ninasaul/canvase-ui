"use client";

import { useStoreApi } from "@xyflow/react";
import { useEffect, useRef } from "react";

/**
 * Zoom percentage. Written straight into the DOM from a store subscription:
 * `useViewport()` re-rendered this label on every pan/zoom frame.
 */
export function CanvasZoomLabel() {
  const storeApi = useStoreApi();
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const apply = (zoom: number) => {
      element.textContent = `${Math.round(zoom * 100)}%`;
    };
    apply(storeApi.getState().transform[2]);
    return storeApi.subscribe((state, previous) => {
      if (state.transform[2] !== previous.transform[2]) {
        apply(state.transform[2]);
      }
    });
  }, [storeApi]);

  return (
    <span
      ref={ref}
      className="min-w-9 text-center text-[10px] tabular-nums text-zinc-500"
    />
  );
}
