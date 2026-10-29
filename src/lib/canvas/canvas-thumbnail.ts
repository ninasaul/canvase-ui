import type { MediaAsset, MediaType } from "@prisma/client";

import {
  isCanvasGraph,
  type CanvasGraph,
  type CanvasNodeData,
} from "@/lib/canvas/graph";

type ThumbnailAssetFields = Pick<
  MediaAsset,
  "id" | "url" | "thumbnailUrl" | "mediaType" | "status"
> | null;

export type CanvasThumbnailFields = {
  thumbnailAssetId: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  previewType: "image" | "video" | null;
};

function previewTypeFor(mediaType: MediaType): "image" | "video" | null {
  if (mediaType === "image") {
    return "image";
  }
  if (mediaType === "video") {
    return "video";
  }
  return null;
}

function firstMediaUrl(data: CanvasNodeData | undefined): string | null {
  if (!data) {
    return null;
  }
  const fromThumb = data.thumbnailUrl?.trim();
  if (fromThumb) {
    return fromThumb;
  }
  const fromUrl = data.url?.trim();
  if (fromUrl) {
    return fromUrl;
  }
  const fromList = data.urls?.find((item) => item.trim())?.trim();
  return fromList || null;
}

/** First usable image/video preview embedded in the canvas graph. */
export function previewFromCanvasGraph(graph: unknown): {
  previewUrl: string | null;
  previewType: "image" | "video" | null;
} {
  if (!isCanvasGraph(graph)) {
    return { previewUrl: null, previewType: null };
  }

  for (const node of graph.nodes) {
    if (node.type !== "image") {
      continue;
    }
    const url = firstMediaUrl(node.data);
    if (url) {
      return { previewUrl: url, previewType: "image" };
    }
  }

  for (const node of graph.nodes) {
    if (node.type !== "video") {
      continue;
    }
    const poster = node.data.thumbnailUrl?.trim();
    if (poster) {
      return { previewUrl: poster, previewType: "image" };
    }
    const url = node.data.url?.trim() || node.data.urls?.[0]?.trim() || null;
    if (url) {
      return { previewUrl: url, previewType: "video" };
    }
  }

  return { previewUrl: null, previewType: null };
}

/** Resolve list/detail cover fields from an optional ready media asset. */
export function canvasThumbnailFields(
  thumbnailAssetId: string | null | undefined,
  asset: ThumbnailAssetFields,
): CanvasThumbnailFields {
  if (!thumbnailAssetId || !asset || asset.status !== "ready") {
    return {
      thumbnailAssetId: thumbnailAssetId ?? null,
      thumbnailUrl: null,
      previewUrl: null,
      previewType: null,
    };
  }
  const previewUrl = asset.thumbnailUrl?.trim() || asset.url.trim() || null;
  return {
    thumbnailAssetId,
    thumbnailUrl: previewUrl,
    previewUrl,
    previewType: previewUrl ? previewTypeFor(asset.mediaType) : null,
  };
}

/**
 * Explicit cover asset wins; otherwise fall back to first media URL in the graph
 * so the canvas list shows a real preview without a manual upload.
 */
export function resolveCanvasCoverFields(
  thumbnailAssetId: string | null | undefined,
  asset: ThumbnailAssetFields,
  graph?: unknown,
): CanvasThumbnailFields {
  const cover = canvasThumbnailFields(thumbnailAssetId, asset);
  if (cover.previewUrl) {
    return cover;
  }
  const fromGraph = previewFromCanvasGraph(graph);
  return {
    ...cover,
    previewUrl: fromGraph.previewUrl,
    previewType: fromGraph.previewType,
  };
}

/**
 * Fill missing node.data.thumbnailUrl from MediaAsset rows (by assetId /
 * assetIds). Display-only; persists on the next canvas save.
 */
export function hydrateGraphNodeThumbnails(
  graph: CanvasGraph,
  assets: Array<{ id: string; thumbnailUrl: string | null }>,
): CanvasGraph {
  if (assets.length === 0) {
    return graph;
  }
  const thumbnailByAssetId = new Map<string, string>();
  for (const asset of assets) {
    const thumbnailUrl = asset.thumbnailUrl?.trim();
    if (thumbnailUrl) {
      thumbnailByAssetId.set(asset.id, thumbnailUrl);
    }
  }
  if (thumbnailByAssetId.size === 0) {
    return graph;
  }

  let changed = false;
  const nodes = graph.nodes.map((node) => {
    if (node.type !== "image" && node.type !== "video") {
      return node;
    }
    if (node.data.thumbnailUrl?.trim()) {
      return node;
    }
    const candidateIds = [
      node.data.assetId,
      ...(node.data.assetIds ?? []),
    ].filter((id): id is string => Boolean(id?.trim()));
    let resolved: string | undefined;
    for (const assetId of candidateIds) {
      resolved = thumbnailByAssetId.get(assetId);
      if (resolved) {
        break;
      }
    }
    if (!resolved) {
      return node;
    }
    changed = true;
    return {
      ...node,
      data: {
        ...node.data,
        thumbnailUrl: resolved,
      },
    };
  });

  return changed ? { ...graph, nodes } : graph;
}

export function collectGraphAssetIds(graph: CanvasGraph): string[] {
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (node.type !== "image" && node.type !== "video") {
      continue;
    }
    if (node.data.assetId?.trim()) {
      ids.add(node.data.assetId.trim());
    }
    for (const assetId of node.data.assetIds ?? []) {
      const trimmed = assetId?.trim();
      if (trimmed) {
        ids.add(trimmed);
      }
    }
  }
  return [...ids];
}
