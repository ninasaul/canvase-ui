"use client";

import type { CanvasNodeRunStatus } from "@/lib/tu-shared-browser";
import { create } from "zustand";

export type CanvasRunStatusEntry = {
  status: CanvasNodeRunStatus;
  error?: string;
  requestId?: string;
  taskId?: string;
};

type CanvasRunStatusStore = {
  statusById: Record<string, CanvasRunStatusEntry>;
  setNode: (
    nodeId: string,
    status: CanvasNodeRunStatus,
    error?: string,
    requestId?: string,
    taskId?: string,
  ) => void;
  setMany: (nodeIds: string[], status: CanvasNodeRunStatus) => void;
  reset: () => void;
};

export const useCanvasRunStatusStore = create<CanvasRunStatusStore>((set) => ({
  statusById: {},
  setNode: (nodeId, status, error, requestId, taskId) =>
    set((state) => {
      const current = state.statusById[nodeId];
      if (
        current?.status === status &&
        current.error === error &&
        current.requestId === requestId &&
        current.taskId === taskId
      ) {
        return state;
      }
      return {
        statusById: {
          ...state.statusById,
          [nodeId]: {
            status,
            ...(error ? { error } : {}),
            ...(requestId ? { requestId } : {}),
            ...(taskId ? { taskId } : {}),
          },
        },
      };
    }),
  setMany: (nodeIds, status) =>
    set((state) => {
      const next = { ...state.statusById };
      let changed = false;
      for (const nodeId of nodeIds) {
        const current = next[nodeId];
        if (current?.status === status && !current.error) {
          continue;
        }
        next[nodeId] = { status };
        changed = true;
      }
      return changed ? { statusById: next } : state;
    }),
  reset: () => set({ statusById: {} }),
}));

export function useCanvasRunStatus(nodeId: string): CanvasRunStatusEntry | undefined {
  return useCanvasRunStatusStore((state) => state.statusById[nodeId]);
}
