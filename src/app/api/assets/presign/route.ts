import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { createPresignedPutUrl } from "@/lib/storage/s3-client";
import {
  buildObjectKey,
  buildPublicObjectUrl,
  resolveStorageConfig,
} from "@/lib/storage/s3-config";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const presignSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  mediaType: z.enum(["image", "video", "audio", "other"]),
  purpose: z
    .enum([
      "playground_upload",
      "generation_output",
      "transfer_input",
      "canvas_thumbnail",
    ])
    .default("playground_upload"),
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

  const parsed = presignSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const storage = await resolveStorageConfig(user.id);
  if (!storage) {
    return jsonError(
      "Object storage is not configured. Open Canvas settings → Storage, or set S3_* env vars.",
      400,
    );
  }

  const assetId = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  const objectKey = buildObjectKey({
    userId: user.id,
    assetId,
    filename: parsed.data.filename,
  });
  const publicUrl = buildPublicObjectUrl(storage, objectKey);

  await prisma.mediaAsset.create({
    data: {
      id: assetId,
      ownerId: user.id,
      objectKey,
      url: publicUrl,
      mimeType: parsed.data.mimeType,
      mediaType: parsed.data.mediaType,
      purpose: parsed.data.purpose,
      displayName: parsed.data.filename,
      sizeBytes: parsed.data.sizeBytes,
      status: "pending",
    },
  });

  try {
    const uploadUrl = await createPresignedPutUrl({
      config: storage,
      objectKey,
      contentType: parsed.data.mimeType,
    });
    return jsonOk({
      assetId,
      key: objectKey,
      uploadUrl,
      publicUrl,
      headers: {
        "Content-Type": parsed.data.mimeType,
      },
    });
  } catch (error) {
    await prisma.mediaAsset.delete({ where: { id: assetId } }).catch(() => undefined);
    return jsonError(
      error instanceof Error ? error.message : "Failed to create upload URL",
      502,
    );
  }
}
