"use client";

import { createContext, useContext } from "react";
import type { PortalPublicModel } from "@/types/admin";

export type CanvasActions = {
  runNode: (nodeId: string) => void;
  cancelNodeRun: (nodeId: string) => void;
  prepareRunSelected: (nodeIds: string[]) => void;
  cancelActiveRun: () => void;
  isBatchRunActive: boolean;
  models: PortalPublicModel[];
  canvasId: string;
};

export const CanvasActionsContext = createContext<CanvasActions | null>(null);

export function useCanvasActions(): CanvasActions {
  const actions = useContext(CanvasActionsContext);
  if (!actions) {
    throw new Error("CanvasActionsContext is missing");
  }
  return actions;
}
