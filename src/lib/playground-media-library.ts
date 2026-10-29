import { portalRequest } from "@/lib/api";
import type { PlaygroundMediaType } from "@/lib/playground/media-references";

export type PortalMediaLibraryItem = {
  id: string;
  url: string;
  mimeType: string;
  mediaType: "image" | "video" | "audio" | "other";
  purpose: string | null;
  displayName: string;
  sizeBytes: number;
  thumbnailUrl: string | null;
  createdAt: string;
  expireAt: string | null;
  deletable: boolean;
};

export type PortalMediaLibraryResponse = {
  items: PortalMediaLibraryItem[];
  nextCursor: string | null;
};

export async function listPortalMediaLibrary(options: {
  mediaType?: PlaygroundMediaType;
  purpose?: "playground_upload" | "generation_output" | "transfer_input";
  limit?: number;
  cursor?: string;
}): Promise<PortalMediaLibraryResponse> {
  const params = new URLSearchParams();
  if (options.mediaType) {
    params.set("mediaType", options.mediaType);
  }
  if (options.purpose) {
    params.set("purpose", options.purpose);
  }
  if (options.limit) {
    params.set("limit", String(options.limit));
  }
  if (options.cursor) {
    params.set("cursor", options.cursor);
  }
  const query = params.toString();
  const result = await portalRequest<PortalMediaLibraryResponse>(
    `/portal/v1/assets${query ? `?${query}` : ""}`,
  );
  return {
    ...result,
    items: result.items.map((item) => ({
      ...item,
      deletable: Boolean(item.deletable),
      thumbnailUrl: item.thumbnailUrl ?? null,
    })),
  };
}

export async function deletePortalMediaLibraryItem(
  assetId: string,
): Promise<void> {
  await portalRequest<{ ok: true }>(
    `/portal/v1/assets/${encodeURIComponent(assetId)}`,
    { method: "DELETE" },
  );
}
