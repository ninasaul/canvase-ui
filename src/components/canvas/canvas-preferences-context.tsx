"use client";

import { createContext, useContext } from "react";
import {
  DEFAULT_CANVAS_PREFERENCES,
  type CanvasPreferences,
} from "@/lib/canvas/canvas-preferences";

const CanvasPreferencesContext = createContext<CanvasPreferences>(
  DEFAULT_CANVAS_PREFERENCES,
);

export const CanvasPreferencesProvider = CanvasPreferencesContext.Provider;

export function useCanvasPreferences(): CanvasPreferences {
  return useContext(CanvasPreferencesContext);
}
