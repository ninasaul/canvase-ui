import "dotenv/config";

import { Worker } from "bullmq";

import { prisma } from "@/lib/prisma";
import {
  assetThumbnailJobId,
  assetThumbnailJobName,
  assetThumbnailQueueName,
  getAssetThumbnailQueue,
  getRedisUrl,
  type AssetThumbnailJobData,
} from "@/lib/storage/asset-thumbnail-queue";
import { generateAssetThumbnail } from "./generate-asset-thumbnail";

const BOOTSTRAP_LIMIT = 200;

function redisConnectionFromUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "127.0.0.1",
    port: Number(parsed.port || "6379") || 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password
      ? decodeURIComponent(parsed.password)
      : undefined,
    maxRetriesPerRequest: null as null,
  };
}

async function enqueueMissingAssetThumbnails(): Promise<void> {
  const queue = getAssetThumbnailQueue();
  if (!queue) {
    return;
  }
  const missing = await prisma.mediaAsset.findMany({
    where: {
      status: "ready",
      thumbnailUrl: null,
      mediaType: { in: ["image", "video"] },
      purpose: { notIn: ["canvas_thumbnail", "canvas_export"] },
    },
    orderBy: { createdAt: "desc" },
    take: BOOTSTRAP_LIMIT,
    select: { id: true },
  });
  for (const asset of missing) {
    await queue.add(
      assetThumbnailJobName,
      { assetId: asset.id },
      { jobId: assetThumbnailJobId(asset.id) },
    );
  }
  if (missing.length > 0) {
    console.log(
      `[asset-thumbnail] bootstrapped ${missing.length} missing thumbnail jobs`,
    );
  }
}

async function main() {
  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    throw new Error("REDIS_URL is required for the asset thumbnail worker");
  }

  const worker = new Worker<AssetThumbnailJobData>(
    assetThumbnailQueueName,
    async (job) => {
      const assetId = job.data.assetId;
      const updated = await generateAssetThumbnail(assetId);
      console.log(
        `[asset-thumbnail] ${assetId} ${updated ? "generated" : "skipped"}`,
      );
    },
    {
      connection: redisConnectionFromUrl(redisUrl),
      concurrency: 2,
    },
  );

  worker.on("failed", (job, error) => {
    console.error(
      `[asset-thumbnail] job failed ${job?.id ?? "?"}:`,
      error.message,
    );
  });

  await enqueueMissingAssetThumbnails();
  console.log(
    `[asset-thumbnail] worker listening on queue "${assetThumbnailQueueName}"`,
  );

  const shutdown = async () => {
    console.log("[asset-thumbnail] shutting down");
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

main().catch(async (error) => {
  console.error("[asset-thumbnail] fatal:", error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
