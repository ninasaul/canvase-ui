import type { CanvasGraph, CanvasNodeData } from "@/lib/canvas/canvas-graph";
import {
  collectGraphAssetIds,
  hydrateGraphNodeThumbnails,
} from "@/lib/canvas/canvas-thumbnail";
import { enqueueAssetThumbnail } from "@/lib/storage/asset-thumbnail-queue";
import { prisma } from "@/lib/prisma";

function collectAssetIdsFromData(data: Partial<CanvasNodeData>): string[] {
  const ids = new Set<string>();
  if (data.assetId?.trim()) {
    ids.add(data.assetId.trim());
  }
  for (const assetId of data.assetIds ?? []) {
    const trimmed = assetId?.trim();
    if (trimmed) {
      ids.add(trimmed);
    }
  }
  return [...ids];
}

async function loadOwnedAssetThumbnails(
  ownerId: string,
  assetIds: string[],
): Promise<Array<{ id: string; thumbnailUrl: string | null }>> {
  if (assetIds.length === 0) {
    return [];
  }
  return prisma.mediaAsset.findMany({
    where: {
      id: { in: assetIds },
      ownerId,
      status: "ready",
    },
    select: { id: true, thumbnailUrl: true },
  });
}

/** Hydrate missing node thumbnailUrl from owned MediaAsset rows (read path). */
export async function hydrateCanvasGraphThumbnails(
  ownerId: string,
  graph: CanvasGraph,
): Promise<CanvasGraph> {
  const assetIds = collectGraphAssetIds(graph);
  if (assetIds.length === 0) {
    return graph;
  }
  const assets = await loadOwnedAssetThumbnails(ownerId, assetIds);
  return hydrateGraphNodeThumbnails(graph, assets);
}

/**
 * After generation/write: if asset already has a thumbnail, return it;
 * otherwise enqueue generation (non-blocking).
 */
export async function resolveNodeThumbnailPatch(
  ownerId: string,
  data: Partial<CanvasNodeData>,
): Promise<{ thumbnailUrl?: string }> {
  if (data.thumbnailUrl?.trim()) {
    return { thumbnailUrl: data.thumbnailUrl.trim() };
  }
  const assetIds = collectAssetIdsFromData(data);
  if (assetIds.length === 0) {
    return {};
  }
  const assets = await loadOwnedAssetThumbnails(ownerId, assetIds);
  for (const assetId of assetIds) {
    const match = assets.find((item) => item.id === assetId);
    const thumbnailUrl = match?.thumbnailUrl?.trim();
    if (thumbnailUrl) {
      return { thumbnailUrl };
    }
  }
  for (const assetId of assetIds) {
    void enqueueAssetThumbnail(assetId);
  }
  return {};
}
