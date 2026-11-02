import type {
  CanvasNodeData,
  CanvasNodeRunStatus,
} from "@/lib/tu-shared-browser";
import { messages } from "@/messages";
import {
  v1Request,
  type V1GenerationResponse,
} from "@/lib/v1-client";
import { withGeneratedAssets } from "./canvas-assets";

export type CanvasTaskMediaKind = "image" | "video";

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

function v1TaskPollPath(
  mediaKind: CanvasTaskMediaKind,
  requestId: string,
): string {
  const encoded = encodeURIComponent(requestId);
  return mediaKind === "video"
    ? `/v1/videos/${encoded}`
    : `/v1/images/${encoded}`;
}

function v1ResponseUrl(detail: V1GenerationResponse): string {
  const fromRoot = detail.url?.trim() ?? "";
  if (fromRoot) {
    return fromRoot;
  }
  const fromData = detail.data?.find((item) => item.url?.trim())?.url?.trim();
  return fromData ?? "";
}

/** Map OpenAI-style async task status onto canvas node run status. */
export function v1TaskStatusToNodeStatus(
  status: string | undefined,
): CanvasNodeRunStatus {
  if (status === "completed") {
    return "succeeded";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "queued") {
    return "queued";
  }
  return "running";
}

/** Pure mapping used by query recovery and unit tests. */
export function v1TaskDetailPatch(
  detail: V1GenerationResponse,
  requestId: string,
  fallbackUrl: string,
): { done: boolean; patch: Partial<CanvasNodeData> } {
  const status = v1TaskStatusToNodeStatus(detail.status);
  if (status === "succeeded") {
    const url = v1ResponseUrl(detail) || fallbackUrl;
    return {
      done: true,
      patch: {
        status: "succeeded",
        ...withGeneratedAssets({}, {
          url,
          urls: url ? [url] : [],
        }),
        requestId: detail.id?.trim() || requestId,
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
          (typeof detail.error === "string" && detail.error.trim()) ||
          messages.canvas.generationFailed,
        requestId: detail.id?.trim() || requestId,
        finishedAt: Date.now(),
      },
    };
  }
  return {
    done: false,
    patch: {
      status,
      requestId: detail.id?.trim() || requestId,
      error: undefined,
    },
  };
}

/**
 * Query an existing V1 generation task by id (GET /v1/images|videos/{id})
 * and follow until terminal. Does not create or re-enqueue a job.
 */
export async function queryCanvasNodeTask(options: {
  nodeId: string;
  requestId: string;
  mediaKind: CanvasTaskMediaKind;
  fallbackUrl: string;
  update: (nodeId: string, patch: Partial<CanvasNodeData>) => void;
  signal: AbortSignal;
  pollMs?: number;
}): Promise<void> {
  const {
    nodeId,
    requestId,
    mediaKind,
    fallbackUrl,
    update,
    signal,
  } = options;
  const pollMs = options.pollMs ?? 2000;
  const pollPath = v1TaskPollPath(mediaKind, requestId);

  while (!signal.aborted) {
    let detail: V1GenerationResponse;
    try {
      detail = await v1Request<V1GenerationResponse>(pollPath, "", {
        signal,
      });
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

    const { done, patch } = v1TaskDetailPatch(detail, requestId, fallbackUrl);
    update(nodeId, patch);
    if (done) {
      return;
    }
    await delay(pollMs, signal);
  }
}

/**
 * Page-reload recovery for in-flight image/video nodes: poll the existing
 * V1 task id until it finishes.
 */
export async function recoverCanvasNode(options: {
  nodeId: string;
  requestId: string;
  mediaKind: CanvasTaskMediaKind;
  fallbackUrl: string;
  update: (nodeId: string, patch: Partial<CanvasNodeData>) => void;
  signal: AbortSignal;
  pollMs?: number;
}): Promise<void> {
  return queryCanvasNodeTask(options);
}

/** @deprecated Prefer v1TaskStatusToNodeStatus / v1TaskDetailPatch. */
export function taskStatusToNodeStatus(
  status: string | undefined,
): CanvasNodeRunStatus {
  if (status === "succeeded" || status === "completed") {
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
