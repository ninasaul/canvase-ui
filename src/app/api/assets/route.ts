import { Prisma } from "@prisma/client";
import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const mediaTypeParam = searchParams.get("mediaType")?.trim() ?? "";
  const purpose = searchParams.get("purpose")?.trim() ?? "";
  const cursor = searchParams.get("cursor")?.trim() ?? "";
  const limit = Math.min(
    100,
    Math.max(1, Number(searchParams.get("limit") ?? "40") || 40),
  );

  const where: Prisma.MediaAssetWhereInput = {
    ownerId: user.id,
    status: "ready",
  };

  if (
    mediaTypeParam === "image" ||
    mediaTypeParam === "video" ||
    mediaTypeParam === "audio" ||
    mediaTypeParam === "other"
  ) {
    where.mediaType = mediaTypeParam;
  }
  if (purpose) {
    where.purpose = purpose;
  }

  const items = await prisma.mediaAsset.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
  });

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

  return jsonOk({
    items: page.map((item) => ({
      id: item.id,
      url: item.url,
      mimeType: item.mimeType,
      mediaType: item.mediaType,
      purpose: item.purpose,
      displayName: item.displayName,
      sizeBytes: item.sizeBytes,
      thumbnailUrl: item.thumbnailUrl,
      createdAt: item.createdAt.toISOString(),
      expireAt: null,
      deletable: true,
    })),
    nextCursor,
  });
}
