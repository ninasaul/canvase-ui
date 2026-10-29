export const MAX_FRAME_REFERENCE_IMAGES = 2;

/** Seedance 2.0 omni-reference caps. */
export const SEEDANCE_20_REFERENCE_LIMITS = {
  frameImages: MAX_FRAME_REFERENCE_IMAGES,
  images: 9,
  videos: 3,
  audio: 3,
} as const;

/** Seedance 2.5 omni-reference caps. */
export const SEEDANCE_25_REFERENCE_LIMITS = {
  frameImages: MAX_FRAME_REFERENCE_IMAGES,
  images: 30,
  videos: 10,
  audio: 10,
} as const;

/** Non-2.5 Seedance default caps (aligned with 2.0). */
export const SEEDANCE_LEGACY_REFERENCE_LIMITS = {
  frameImages: MAX_FRAME_REFERENCE_IMAGES,
  images: 9,
  videos: 3,
  audio: 3,
} as const;

export type VideoReferenceLimits = {
  frameImages: number;
  images: number;
  videos: number;
  audio: number;
};

export type PlaygroundMediaType = "image" | "video" | "audio";
export type VideoReferenceMode = "frame" | "omni";

export type PlaygroundMediaReference = {
  id: string;
  mediaType: PlaygroundMediaType;
  sourceKind: "file" | "url";
  name: string;
  previewUrl: string;
  file?: File;
  url?: string;
  assetId?: string;
};

/** Fallback resolutions when a family does not define its own list. */
export const VIDEO_RESOLUTIONS = [
  "480p",
  "720p",
  "1080p",
  "4k",
  "768p",
  "2k",
] as const;

export type VideoResolution = (typeof VIDEO_RESOLUTIONS)[number];
