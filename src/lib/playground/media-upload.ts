import type { PlaygroundMediaType } from "@/lib/playground/media-references";

export type PlaygroundMediaUploadOption = {
  mediaType: PlaygroundMediaType;
  accept: string;
  label: string;
};

/**
 * Resolve a picked/dropped file to a reference media type against the options
 * still offered by the composer (combined image/video/audio picker).
 */
export function detectPlaygroundUploadMediaType(
  file: { type: string },
  options: readonly PlaygroundMediaUploadOption[],
): PlaygroundMediaType | null {
  for (const option of options) {
    if (option.mediaType === "image" && file.type.startsWith("image/")) {
      return "image";
    }
    if (option.mediaType === "video" && file.type.startsWith("video/")) {
      return "video";
    }
    if (option.mediaType === "audio" && file.type.startsWith("audio/")) {
      return "audio";
    }
  }
  return null;
}

/** Join accept filters for a single multi-type file dialog. */
export function buildCombinedUploadAccept(
  options: readonly PlaygroundMediaUploadOption[],
): string {
  return options
    .map((option) => option.accept.trim())
    .filter(Boolean)
    .join(",");
}
