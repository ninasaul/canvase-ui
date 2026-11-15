"use client";

import { create } from "zustand";

import type { CanvasHelperLines } from "./canvas-helper-lines";

type CanvasHelperLinesState = {
  lines: CanvasHelperLines | null;
  setLines: (lines: CanvasHelperLines | null) => void;
  clear: () => void;
};

/**
 * Alignment guides live in their own store instead of editor state.
 *
 * They update on every drag frame; as `useState` in the editor they forced the
 * whole editor tree (chat panel, docks, modals) to re-render 60 times a second
 * just to move two 1px lines. Now only the overlay subscribes.
 */
export const useCanvasHelperLinesStore = create<CanvasHelperLinesState>(
  (set) => ({
    lines: null,
    setLines: (lines) =>
      set((state) => {
        if (
          state.lines === lines ||
          (state.lines !== null &&
            lines !== null &&
            state.lines.horizontal === lines.horizontal &&
            state.lines.vertical === lines.vertical)
        ) {
          return state;
        }
        return { lines };
      }),
    clear: () =>
      set((state) => (state.lines === null ? state : { lines: null })),
  }),
);
