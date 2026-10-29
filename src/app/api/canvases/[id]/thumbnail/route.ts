import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { canvasThumbnailFields } from "@/lib/canvas/canvas-thumbnail";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const bindThumbnailSchema = z.object({
  assetId: z.string().trim().min(1).max(64),
});

export async function POST(request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const { id } = await context.params;
  const canvas = await prisma.canvas.findFirst({
    where: { id, ownerId: user.id, status: "active" },
  });
  if (!canvas) {
    return jsonError("Canvas not found", 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = bindThumbnailSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const asset = await prisma.mediaAsset.findFirst({
    where: {
      id: parsed.data.assetId,
      ownerId: user.id,
      status: "ready",
      mediaType: "image",
    },
  });
  if (!asset) {
    return jsonError("Ready image asset not found", 404);
  }

  const updated = await prisma.canvas.update({
    where: { id: canvas.id },
    data: { thumbnailAssetId: asset.id },
    include: {
      thumbnailAsset: {
        select: {
          id: true,
          url: true,
          thumbnailUrl: true,
          mediaType: true,
          status: true,
        },
      },
    },
  });

  const cover = canvasThumbnailFields(
    updated.thumbnailAssetId,
    updated.thumbnailAsset,
  );

  return jsonOk({
    thumbnailAssetId: cover.thumbnailAssetId,
    thumbnailUrl: cover.thumbnailUrl,
  });
}
