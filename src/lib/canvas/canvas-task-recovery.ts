import type {
  CanvasNodeData,
  CanvasNodeRunStatus,
} from "@/lib/tu-shared-browser";
import { portalRequest } from "@/lib/api";
import { messages } from "@/messages";
import {
  canvasAssetsFromTask,
  withGeneratedAssets,
  type PortalTaskAssetDetail,
} from "./canvas-assets";

export type PortalTaskDetail = PortalTaskAssetDetail & {
  id?: string;
  publicId?: string;
  status?: string;
  progress?: number;
  errorMessage?: string | null;
};

export function taskStatusToNodeStatus(
  status: string | undefined,
): CanvasNodeRunStatus {
  if (status === "succeeded") {
    return "succeeded";
  }
  if (status === "failed" || status === "timeout") {
    return "failed";
  }
  if (status === "queued") {
    return "queued";
  }
  return "running";
}

/** Pure mapping used by refresh recovery and unit tests. */
export function taskDetailPatch(
  detail: PortalTaskDetail,
  fallbackUrl: string,
): { done: boolean; patch: Partial<CanvasNodeData> } {
  const status = taskStatusToNodeStatus(detail.status);
  if (status === "succeeded") {
    const assets = canvasAssetsFromTask(detail, fallbackUrl);
    return {
      done: true,
      patch: {
        status: "succeeded",
        ...withGeneratedAssets({}, assets),
        requestId: detail.id,
        error: undefined,
        finishedAt: Date.now(),
      },
    };
  }
  if (status === "failed") {
    return {
      done: true,
      patch: {
        status: "failed",
        error:
          detail.errorMessage?.trim() || messages.canvas.generationFailed,
        finishedAt: Date.now(),
      },
    };
  }
  return {
    done: false,
    patch: {
      status,
      error: undefined,
    },
  };
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Refresh recovery: ask the portal to re-enqueue upstream polling once, then
 * follow the DB task until it reaches a terminal state.
 */
export async function recoverCanvasNode(options: {
  nodeId: string;
  requestId: string;
  fallbackUrl: string;
  update: (nodeId: string, patch: Partial<CanvasNodeData>) => void;
  signal: AbortSignal;
  pollMs?: number;
}): Promise<void> {
  const { nodeId, requestId, fallbackUrl, update, signal } = options;
  const pollMs = options.pollMs ?? 2000;
  let detail: PortalTaskDetail;
  try {
    detail = await portalRequest<PortalTaskDetail>(
      `/portal/v1/tasks/${encodeURIComponent(requestId)}/query`,
      { method: "POST" },
    );
  } catch (error) {
    if (!signal.aborted) {
      update(nodeId, {
        status: "interrupted",
        error:
          error instanceof Error
            ? error.message
            : messages.canvas.taskRecoveryFailed,
      });
    }
    return;
  }

  while (!signal.aborted) {
    const { done, patch } = taskDetailPatch(detail, fallbackUrl);
    update(nodeId, patch);
    if (done) {
      return;
    }
    await delay(pollMs, signal);
    if (signal.aborted) {
      return;
    }
    try {
      detail = await portalRequest<PortalTaskDetail>(
        `/portal/v1/tasks/${encodeURIComponent(requestId)}`,
      );
    } catch {
      update(nodeId, {
        status: "interrupted",
        error: messages.canvas.taskRecoveryFailed,
      });
      return;
    }
  }
}
