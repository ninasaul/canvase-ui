"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Level-of-detail for the canvas. Derived from the viewport zoom, but kept in
 * context and updated only when a pan/zoom gesture ends, so nodes do not
 * re-render on every frame.
 */
export type CanvasDetail = {
  /** Zoomed far out: media is illegible, so skip mounting it at all. */
  far: boolean;
  /** Zoomed in enough that edge role labels are readable (and clickable). */
  showEdgeLabels: boolean;
};

const DEFAULT_DETAIL: CanvasDetail = { far: false, showEdgeLabels: true };

const CanvasDetailContext = createContext<CanvasDetail>(DEFAULT_DETAIL);

export function CanvasDetailProvider({
  value,
  children,
}: {
  value: CanvasDetail;
  children: ReactNode;
}) {
  return (
    <CanvasDetailContext.Provider value={value}>
      {children}
    </CanvasDetailContext.Provider>
  );
}

export function useCanvasDetail(): CanvasDetail {
  return useContext(CanvasDetailContext);
}
