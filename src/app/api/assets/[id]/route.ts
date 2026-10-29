import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { deleteObject } from "@/lib/storage/s3-client";
import { resolveStorageConfig } from "@/lib/storage/s3-config";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const { id } = await context.params;
  const asset = await prisma.mediaAsset.findFirst({
    where: { id, ownerId: user.id },
  });
  if (!asset) {
    return jsonError("Asset not found", 404);
  }

  const storage = await resolveStorageConfig(user.id);
  if (storage) {
    try {
      await deleteObject({
        config: storage,
        objectKey: asset.objectKey,
      });
    } catch {
      // Keep deleting DB row even if remote delete fails.
    }
  }

  await prisma.mediaAsset.delete({ where: { id: asset.id } });
  return jsonOk({ ok: true as const });
}
