import { Queue } from "bullmq";

export const assetThumbnailQueueName = "asset-thumbnails";
export const assetThumbnailJobName = "generate-thumbnail";

export type AssetThumbnailJobData = {
  assetId: string;
};

export function assetThumbnailJobId(assetId: string): string {
  return `asset-thumbnail-${assetId}`;
}

const SKIP_PURPOSES = new Set(["canvas_thumbnail", "canvas_export"]);

export function shouldEnqueueAssetThumbnail(input: {
  mediaType: string;
  purpose: string;
  thumbnailUrl?: string | null;
}): boolean {
  if (input.thumbnailUrl?.trim()) {
    return false;
  }
  if (SKIP_PURPOSES.has(input.purpose)) {
    return false;
  }
  return input.mediaType === "image" || input.mediaType === "video";
}

function redisConnectionFromUrl(url: string) {
  const parsed = new URL(url);
  // Honour the database suffix (`redis://host:6379/1`). BullMQ otherwise
  // defaults to db 0 and silently shares queues with other local apps.
  const rawDb = parsed.pathname.replace(/^\//, "").trim();
  const parsedDb = rawDb ? Number(rawDb) : 0;
  return {
    host: parsed.hostname || "127.0.0.1",
    port: Number(parsed.port || "6379") || 6379,
    db: Number.isInteger(parsedDb) && parsedDb >= 0 ? parsedDb : 0,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password
      ? decodeURIComponent(parsed.password)
      : undefined,
    maxRetriesPerRequest: null as null,
  };
}

let queueSingleton: Queue<AssetThumbnailJobData> | null = null;

export function getRedisUrl(): string | null {
  const value = process.env.REDIS_URL?.trim();
  return value || null;
}

export function getAssetThumbnailQueue(): Queue<AssetThumbnailJobData> | null {
  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    return null;
  }
  if (!queueSingleton) {
    queueSingleton = new Queue<AssetThumbnailJobData>(assetThumbnailQueueName, {
      connection: redisConnectionFromUrl(redisUrl),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 3,
        backoff: { type: "exponential", delay: 2_000 },
      },
    });
  }
  return queueSingleton;
}

/** Fire-and-forget enqueue; never throws into the upload path. */
export async function enqueueAssetThumbnail(assetId: string): Promise<void> {
  const queue = getAssetThumbnailQueue();
  if (!queue) {
    console.warn(
      "[asset-thumbnail] REDIS_URL unset; skip enqueue for",
      assetId,
    );
    return;
  }
  try {
    await queue.add(
      assetThumbnailJobName,
      { assetId },
      { jobId: assetThumbnailJobId(assetId) },
    );
  } catch (error) {
    console.warn(
      "[asset-thumbnail] enqueue failed",
      assetId,
      error instanceof Error ? error.message : error,
    );
  }
}
