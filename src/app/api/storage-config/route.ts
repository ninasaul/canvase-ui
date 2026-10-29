import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { encryptSecret } from "@/lib/storage/secret-crypto";
import {
  assertUsableStorageEndpoint,
  getPublicStorageConfigView,
  normalizeStorageEndpoint,
} from "@/lib/storage/s3-config";


export const runtime = "nodejs";

const putSchema = z.object({
  endpoint: z.string().trim().url().max(500),
  region: z.string().trim().min(1).max(64).default("auto"),
  bucket: z.string().trim().min(1).max(255),
  accessKeyId: z.string().trim().min(1).max(255),
  secretAccessKey: z.string().trim().max(512).optional(),
  publicBaseUrl: z.string().trim().url().max(500),
  forcePathStyle: z.boolean().default(true),
});

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }
  const view = await getPublicStorageConfigView(user.id);
  return jsonOk(view);
}

export async function PUT(request: Request) {
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

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const existing = await prisma.userStorageConfig.findUnique({
    where: { userId: user.id },
  });

  const secretInput = parsed.data.secretAccessKey?.trim() ?? "";
  if (!secretInput && !existing?.secretAccessKeyCipher) {
    return jsonError("Secret Access Key is required", 400);
  }

  const encrypted = secretInput
    ? encryptSecret(secretInput)
    : {
        cipher: existing!.secretAccessKeyCipher,
        iv: existing!.secretAccessKeyIv,
      };

  const bucket = parsed.data.bucket.trim();
  const endpoint = normalizeStorageEndpoint(parsed.data.endpoint, bucket);
  const publicBaseUrl = parsed.data.publicBaseUrl.replace(/\/$/, "");
  try {
    assertUsableStorageEndpoint(endpoint);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Invalid endpoint",
      400,
    );
  }

  await prisma.userStorageConfig.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      endpoint,
      region: parsed.data.region,
      bucket,
      accessKeyId: parsed.data.accessKeyId,
      secretAccessKeyCipher: encrypted.cipher,
      secretAccessKeyIv: encrypted.iv,
      publicBaseUrl,
      forcePathStyle: parsed.data.forcePathStyle,
    },
    update: {
      endpoint,
      region: parsed.data.region,
      bucket,
      accessKeyId: parsed.data.accessKeyId,
      secretAccessKeyCipher: encrypted.cipher,
      secretAccessKeyIv: encrypted.iv,
      publicBaseUrl,
      forcePathStyle: parsed.data.forcePathStyle,
    },
  });

  const view = await getPublicStorageConfigView(user.id);
  return jsonOk(view);
}

export async function DELETE() {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }
  await prisma.userStorageConfig.deleteMany({ where: { userId: user.id } });
  const view = await getPublicStorageConfigView(user.id);
  return jsonOk(view);
}
