import type { CanvasNodeData } from "@/lib/tu-shared-browser";

export type PortalTaskAsset = {
  id: string;
  publicUrl: string;
  mimeType: string;
};

export type PortalTaskAssetDetail = {
  asset?: PortalTaskAsset | null;
  assets?: PortalTaskAsset[];
};

export type CanvasGeneratedAssets = {
  url: string;
  urls: string[];
  assetId?: string;
  assetIds?: string[];
  thumbnailUrl?: string;
};

/**
 * Task detail returns ordered assets. The first asset is the preview and all
 * ids are persisted on the node so CanvasAsset sync can map them.
 */
export function canvasAssetsFromTask(
  detail: PortalTaskAssetDetail | null | undefined,
  fallbackUrl: string,
): CanvasGeneratedAssets {
  const assets = detail?.assets?.length
    ? detail.assets
    : detail?.asset
      ? [detail.asset]
      : [];
  const urls = assets
    .map((asset) => asset.publicUrl?.trim())
    .filter((url): url is string => Boolean(url));
  const uniqueUrls = [...new Set([...urls, fallbackUrl].filter(Boolean))];
  return {
    url: urls[0] ?? fallbackUrl,
    urls: uniqueUrls,
    ...(assets[0]?.id ? { assetId: assets[0].id } : {}),
    ...(assets.length > 0
      ? { assetIds: assets.map((asset) => asset.id) }
      : {}),
  };
}

export function withGeneratedAssets(
  patch: Partial<CanvasNodeData>,
  assets: CanvasGeneratedAssets,
): Partial<CanvasNodeData> {
  return {
    ...patch,
    url: assets.url,
    urls: assets.urls,
    ...(assets.assetId ? { assetId: assets.assetId } : {}),
    ...(assets.assetIds ? { assetIds: assets.assetIds } : {}),
    ...(assets.thumbnailUrl?.trim()
      ? { thumbnailUrl: assets.thumbnailUrl.trim() }
      : {}),
  };
}
