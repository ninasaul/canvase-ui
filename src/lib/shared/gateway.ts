export const imageWaitTimeoutMs = 5 * 60 * 1000;
export const imagePollIntervalMs = 2_000;
export const videoPollIntervalMs = 3_000;
/** Minimum wait while upstream is still queued/running. */
export const videoTimeoutMinMs = 60 * 60 * 1000;
/** Extra wait budget per requested video second (e.g. 30s → +60m). */
export const videoTimeoutPerSecondMs = 2 * 60 * 1000;
/** Hard cap for generation wait (transferring is not subject to this). */
export const videoTimeoutMaxMs = 120 * 60 * 1000;
/** @deprecated Use {@link resolveVideoWaitTimeoutMs} for per-task limits. */
export const videoTimeoutMs = videoTimeoutMinMs;

export function resolveVideoWaitTimeoutMs(seconds: number | null | undefined): number {
  const normalized =
    typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0
      ? seconds
      : 5;
  return Math.min(
    videoTimeoutMaxMs,
    Math.max(videoTimeoutMinMs, normalized * videoTimeoutPerSecondMs),
  );
}

/** Generation wait budget aligned with worker task timeout. */
export function resolveGenerationWaitTimeoutMs(
  kind: "image" | "video",
  seconds: number | null | undefined,
): number {
  return kind === "image"
    ? imageWaitTimeoutMs
    : resolveVideoWaitTimeoutMs(seconds);
}

/** Poll / run-image queue (light, high concurrency). */
export const generationPollQueueName = "generation-poll";
/** Rehost / download queue (heavy, low concurrency). */
export const generationTransferQueueName = "generation-transfer";
/** expire-assets and similar. */
export const generationMaintenanceQueueName = "generation-maintenance";
/**
 * @deprecated Alias of {@link generationPollQueueName}. Prefer the explicit name.
 * Legacy BullMQ queue name `generation` is no longer written; ignore leftovers.
 */
export const generationQueueName = generationPollQueueName;

export const pollVideoJobName = "poll-video";
export const pollImageJobName = "poll-image";
/** Run createImage for platform-async tasks (no upstream task id yet). */
export const runImageJobName = "run-image";
export const transferVideoJobName = "transfer-video";
export const transferImageJobName = "transfer-image";
export const expireAssetsJobName = "expire-assets";

/** Base delay between transfer retries. */
export const transferRetryDelayMs = 5_000;
/** Max transfer attempts before marking the task failed. */
export const transferMaxAttempts = 10;

export function resolveTransferRetryDelayMs(attempt: number): number {
  const normalized =
    typeof attempt === "number" && Number.isFinite(attempt) && attempt > 0
      ? Math.floor(attempt)
      : 1;
  return transferRetryDelayMs * Math.min(normalized, 6);
}

export function shouldFailTransferAttempts(attempt: number): boolean {
  return attempt >= transferMaxAttempts;
}

/** BullMQ custom jobId cannot contain `:`. */
export function pollJobId(kind: "image" | "video", taskId: string): string {
  return kind === "image" ? `poll-image_${taskId}` : `poll-video_${taskId}`;
}

export function runImageJobId(taskId: string): string {
  return `run-image_${taskId}`;
}

export function transferJobId(kind: "image" | "video", taskId: string): string {
  return kind === "image" ? `transfer-image_${taskId}` : `transfer-video_${taskId}`;
}

export function transferJobName(kind: "image" | "video"): string {
  return kind === "image" ? transferImageJobName : transferVideoJobName;
}

/** Finished unique jobs must be removed before the same jobId can be re-added. */
export function shouldReplaceFinishedUniqueJob(state: string): boolean {
  return state === "completed" || state === "failed";
}

/** Job already scheduled or running — skip duplicate enqueue. */
export function shouldSkipActiveUniqueJob(state: string): boolean {
  return (
    state === "active" ||
    state === "waiting" ||
    state === "delayed" ||
    state === "paused" ||
    state === "waiting-children"
  );
}

export type PollVideoJobData = {
  taskId: string;
};

export type PollImageJobData = {
  taskId: string;
};

export type RunImageJobData = {
  taskId: string;
};

export type TransferJobData = {
  taskId: string;
  sourceUrl?: string;
  sourceUrls?: string[];
  b64Json?: string[];
  downloadHeaders?: Record<string, string>;
  /** 1-based attempt count for retry budgeting. */
  attempt?: number;
};
