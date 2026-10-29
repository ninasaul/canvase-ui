import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { decryptSecret } from "@/lib/storage/secret-crypto";
import { testStorageConnection } from "@/lib/storage/s3-client";
import {
  assertUsableStorageEndpoint,
  normalizeStorageEndpoint,
  resolveStorageConfig,
  type ResolvedStorageConfig,
} from "@/lib/storage/s3-config";

export const runtime = "nodejs";

const draftSchema = z.object({
  endpoint: z.string().trim().url().max(500),
  region: z.string().trim().min(1).max(64).default("auto"),
  bucket: z.string().trim().min(1).max(255),
  accessKeyId: z.string().trim().min(1).max(255),
  secretAccessKey: z.string().trim().max(512).optional(),
  publicBaseUrl: z.string().trim().url().max(500),
  forcePathStyle: z.boolean().default(true),
});

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const contentType = request.headers.get("content-type") ?? "";
  let draft: z.infer<typeof draftSchema> | null = null;

  if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }
    if (body && typeof body === "object" && Object.keys(body as object).length > 0) {
      const parsed = draftSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
      }
      draft = parsed.data;
    }
  }

  let config: ResolvedStorageConfig | null = null;

  if (draft) {
    const bucket = draft.bucket.trim();
    const endpoint = normalizeStorageEndpoint(draft.endpoint, bucket);
    try {
      assertUsableStorageEndpoint(endpoint);
    } catch (error) {
      return jsonError(
        error instanceof Error ? error.message : "Invalid endpoint",
        400,
      );
    }

    let secretAccessKey = draft.secretAccessKey?.trim() ?? "";
    if (!secretAccessKey) {
      const existing = await prisma.userStorageConfig.findUnique({
        where: { userId: user.id },
      });
      if (existing?.secretAccessKeyCipher) {
        secretAccessKey = decryptSecret(
          existing.secretAccessKeyCipher,
          existing.secretAccessKeyIv,
        ).trim();
      }
    }
    if (!secretAccessKey) {
      const envFallback = await resolveStorageConfig(user.id);
      secretAccessKey = envFallback?.secretAccessKey ?? "";
    }
    if (!secretAccessKey) {
      return jsonError("Secret Access Key is required to test storage", 400);
    }

    config = {
      endpoint,
      region: draft.region.trim() || "auto",
      bucket,
      accessKeyId: draft.accessKeyId.trim(),
      secretAccessKey,
      publicBaseUrl: draft.publicBaseUrl.replace(/\/$/, ""),
      forcePathStyle: draft.forcePathStyle,
      source: "user",
    };
  } else {
    config = await resolveStorageConfig(user.id);
  }

  if (!config) {
    return jsonError(
      "Object storage is not configured. Set S3_* env vars or fill Storage settings.",
      400,
    );
  }

  const result = await testStorageConnection(config);
  if (!result.ok) {
    return jsonError(result.message, 502);
  }

  return jsonOk({
    ok: true,
    source: config.source,
    endpoint: config.endpoint,
    bucket: config.bucket,
    publicBaseUrl: config.publicBaseUrl,
  });
}
