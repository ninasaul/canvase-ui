import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  enqueueAssetThumbnail,
  shouldEnqueueAssetThumbnail,
} from "@/lib/storage/asset-thumbnail-queue";
import { headObjectExists } from "@/lib/storage/s3-client";
import { resolveStorageConfig } from "@/lib/storage/s3-config";

export const runtime = "nodejs";

const completeSchema = z.object({
  assetId: z.string().trim().min(1).max(64),
});

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const asset = await prisma.mediaAsset.findFirst({
    where: { id: parsed.data.assetId, ownerId: user.id },
  });
  if (!asset) {
    return jsonError("Asset not found", 404);
  }

  const storage = await resolveStorageConfig(user.id);
  if (!storage) {
    return jsonError("Object storage is not configured", 400);
  }

  const exists = await headObjectExists({
    config: storage,
    objectKey: asset.objectKey,
  });
  if (!exists) {
    await prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { status: "failed" },
    });
    return jsonError("Upload object not found in storage", 400);
  }

  const ready = await prisma.mediaAsset.update({
    where: { id: asset.id },
    data: { status: "ready" },
  });

  if (
    shouldEnqueueAssetThumbnail({
      mediaType: ready.mediaType,
      purpose: ready.purpose,
      thumbnailUrl: ready.thumbnailUrl,
    })
  ) {
    void enqueueAssetThumbnail(ready.id);
  }

  return jsonOk({
    id: ready.id,
    url: ready.url,
    assetId: ready.id,
    mimeType: ready.mimeType,
    mediaType: ready.mediaType,
    purpose: ready.purpose,
    displayName: ready.displayName,
    sizeBytes: ready.sizeBytes,
    thumbnailUrl: ready.thumbnailUrl,
    createdAt: ready.createdAt.toISOString(),
    expireAt: null,
    deletable: true,
  });
}
