/** How an Asset was created — used by the portal media library. */
export type AssetPurpose =
  | "playground_upload"
  | "generation_output"
  | "transfer_input"
  | "canvas_thumbnail"
  | "canvas_export";

/** Media library listing window (days). */
export const MEDIA_LIBRARY_RETENTION_DAYS = 3;

/** Default playground upload TTL when env is unset (hours). */
export const DEFAULT_PLAYGROUND_ASSET_RETENTION_HOURS =
  MEDIA_LIBRARY_RETENTION_DAYS * 24;

export function buildAssetDisplayName(
  fileName: string,
  fallback = "file",
): string {
  const trimmed = fileName.trim();
  const lastDot = trimmed.lastIndexOf(".");
  const hasExtension =
    lastDot > 0 &&
    lastDot < trimmed.length - 1 &&
    !trimmed.slice(lastDot + 1).includes("/");
  const stemRaw = hasExtension ? trimmed.slice(0, lastDot) : trimmed;
  const extension = hasExtension ? trimmed.slice(lastDot) : "";
  const stem = (stemRaw.replace(/[/\\]+/g, "_").trim() || fallback).slice(0, 120);
  const suffix = String(Math.floor(Math.random() * 100)).padStart(2, "0");
  return `${stem}_${suffix}${extension}`;
}

export function mediaKindFromMime(
  mimeType: string,
): "image" | "video" | "audio" | "other" {
  const mime = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (mime.startsWith("image/")) {
    return "image";
  }
  if (mime.startsWith("video/")) {
    return "video";
  }
  if (mime.startsWith("audio/")) {
    return "audio";
  }
  return "other";
}
