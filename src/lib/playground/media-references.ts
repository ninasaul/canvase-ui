import { buildAssetDisplayName } from "@/lib/tu-shared-browser";
import { fileToDataUrl, parseReferenceUrls } from "@/lib/playground-media";
import type { PlaygroundImageReference } from "@/lib/playground/image-references";
import type {
  PlaygroundMediaReference,
  PlaygroundMediaType,
  VideoReferenceLimits,
  VideoReferenceMode,
} from "@canvase/generation-params";
import {
  MAX_FRAME_REFERENCE_IMAGES,
  SEEDANCE_20_REFERENCE_LIMITS,
  SEEDANCE_25_REFERENCE_LIMITS,
  SEEDANCE_LEGACY_REFERENCE_LIMITS,
} from "@canvase/generation-params";

export const MAX_MEDIA_REFERENCE_BYTES = 50 * 1024 * 1024;
export {
  MAX_FRAME_REFERENCE_IMAGES,
  SEEDANCE_20_REFERENCE_LIMITS,
  SEEDANCE_25_REFERENCE_LIMITS,
  SEEDANCE_LEGACY_REFERENCE_LIMITS,
};
export type {
  PlaygroundMediaReference,
  PlaygroundMediaType,
  VideoReferenceLimits,
  VideoReferenceMode,
};

/** @deprecated Use profile.referenceLimits or getVideoReferenceLimits(model). */
export const MAX_VIDEO_REFERENCE_IMAGES = SEEDANCE_20_REFERENCE_LIMITS.images;
/** @deprecated Use profile.referenceLimits or getVideoReferenceLimits(model). */
export const MAX_VIDEO_REFERENCE_VIDEOS = SEEDANCE_20_REFERENCE_LIMITS.videos;
/** @deprecated Use profile.referenceLimits or getVideoReferenceLimits(model). */
export const MAX_VIDEO_REFERENCE_AUDIO = SEEDANCE_20_REFERENCE_LIMITS.audio;

type DraftMediaRef = {
  mediaType: PlaygroundMediaType;
  url: string;
  assetId?: string;
};

function newMediaReferenceId(): string {
  return `media_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Display name for uploaded refs: `{stem}_{00-99}{ext}` (keeps original basename). */
export function buildUploadedMediaDisplayName(
  fileName: string,
  fallback = "file",
): string {
  return buildAssetDisplayName(fileName, fallback);
}

function defaultMediaName(file: File, mediaType: PlaygroundMediaType): string {
  return buildUploadedMediaDisplayName(file.name || "", mediaType);
}

export function createMediaFileReference(
  file: File,
  mediaType: PlaygroundMediaType,
): PlaygroundMediaReference {
  if (file.size > MAX_MEDIA_REFERENCE_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }
  return {
    id: newMediaReferenceId(),
    mediaType,
    sourceKind: "file",
    name: defaultMediaName(file, mediaType),
    previewUrl: URL.createObjectURL(file),
    file,
  };
}

export function createMediaUrlReference(
  url: string,
  mediaType: PlaygroundMediaType,
  index = 0,
  displayName?: string,
  assetId?: string,
): PlaygroundMediaReference {
  const trimmed = url.trim();
  const label =
    displayName?.trim() ||
    (() => {
      try {
        const parsed = new URL(trimmed);
        const segment = parsed.pathname.split("/").filter(Boolean).pop();
        return segment || `${mediaType}-${index + 1}`;
      } catch {
        return `${mediaType}-${index + 1}`;
      }
    })();
  return {
    id: newMediaReferenceId(),
    mediaType,
    sourceKind: "url",
    name: label,
    previewUrl: trimmed,
    url: trimmed,
    ...(assetId ? { assetId } : {}),
  };
}

/** Stable key for deduping library / URL references (pathname without query/hash). */
export function mediaReferenceUrlKey(url: string | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

export function mediaReferenceIdentityKey(
  reference: PlaygroundMediaReference,
): string | null {
  return (
    mediaReferenceUrlKey(reference.url) ??
    mediaReferenceUrlKey(reference.previewUrl)
  );
}

export function isMediaUrlInReferences(
  url: string,
  references: readonly PlaygroundMediaReference[],
  options: { exceptIndex?: number } = {},
): boolean {
  const key = mediaReferenceUrlKey(url);
  if (!key) {
    return false;
  }
  return references.some((reference, index) => {
    if (options.exceptIndex !== undefined && index === options.exceptIndex) {
      return false;
    }
    return mediaReferenceIdentityKey(reference) === key;
  });
}

export function imageReferenceToMedia(
  reference: PlaygroundImageReference,
): PlaygroundMediaReference {
  return {
    id: reference.id,
    mediaType: "image",
    sourceKind: reference.kind,
    name: reference.name,
    previewUrl: reference.previewUrl,
    file: reference.file,
    url: reference.url,
    assetId: reference.assetId,
  };
}

export function mediaToImageReference(
  reference: PlaygroundMediaReference,
): PlaygroundImageReference {
  return {
    id: reference.id,
    kind: reference.sourceKind,
    name: reference.name,
    previewUrl: reference.previewUrl,
    file: reference.file,
    url: reference.url,
    assetId: reference.assetId,
  };
}

export function mediaReferencesFromDraftString(
  value: string,
): PlaygroundMediaReference[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as DraftMediaRef[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .filter(
          (item) =>
            item &&
            typeof item.url === "string" &&
            (item.mediaType === "image" ||
              item.mediaType === "video" ||
              item.mediaType === "audio"),
        )
        .filter((item) => !item.url.startsWith("data:"))
        .map((item, index) =>
          createMediaUrlReference(
            item.url,
            item.mediaType,
            index,
            undefined,
            item.assetId,
          ),
        );
    } catch {
      return [];
    }
  }

  return parseReferenceUrls(trimmed)
    .filter((url) => !url.startsWith("data:"))
    .map((url, index) => createMediaUrlReference(url, "image", index));
}

export function mediaReferencesForDraft(
  references: PlaygroundMediaReference[],
): string {
  const payload: DraftMediaRef[] = references
    .filter((item) => item.sourceKind === "url" && item.url)
    .map((item) => ({
      mediaType: item.mediaType,
      url: item.url!,
      ...(item.assetId ? { assetId: item.assetId } : {}),
    }));
  return payload.length > 0 ? JSON.stringify(payload) : "";
}

export function videoReferencesFromDraft(draft: {
  videoFirstFrame: string;
  videoReferences: string;
}): PlaygroundMediaReference[] {
  const fromJson = mediaReferencesFromDraftString(draft.videoReferences);
  if (fromJson.length > 0 || draft.videoReferences.trim().startsWith("[")) {
    return fromJson;
  }

  const urls: string[] = [];
  const first = draft.videoFirstFrame.trim();
  if (first) {
    urls.push(first);
  }
  for (const url of parseReferenceUrls(draft.videoReferences)) {
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }
  return urls
    .filter((url) => !url.startsWith("data:"))
    .map((url, index) => createMediaUrlReference(url, "image", index));
}

export function revokeMediaReferencePreviews(
  references: PlaygroundMediaReference[],
): void {
  for (const item of references) {
    if (item.sourceKind === "file" && item.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }
}

export async function resolveMediaReferenceUrl(
  reference: PlaygroundMediaReference,
): Promise<string> {
  if (reference.sourceKind === "url" && reference.url) {
    return reference.url;
  }
  if (reference.sourceKind === "file" && reference.file) {
    return fileToDataUrl(reference.file);
  }
  throw new Error("INVALID_REFERENCE");
}

export function countMediaReferences(
  references: readonly PlaygroundMediaReference[],
  mediaType: PlaygroundMediaType,
): number {
  return references.filter((item) => item.mediaType === mediaType).length;
}

export function canAddMediaReference(
  references: readonly PlaygroundMediaReference[],
  mediaType: PlaygroundMediaType,
  mode: VideoReferenceMode,
  limits: VideoReferenceLimits,
): boolean {
  if (mode === "frame") {
    return (
      mediaType === "image" &&
      countMediaReferences(references, "image") < limits.frameImages
    );
  }

  if (mediaType === "image") {
    return countMediaReferences(references, "image") < limits.images;
  }
  if (mediaType === "video") {
    return (
      limits.videos > 0 &&
      countMediaReferences(references, "video") < limits.videos
    );
  }
  return (
    limits.audio > 0 && countMediaReferences(references, "audio") < limits.audio
  );
}

export function filterMediaReferencesForMode(
  references: readonly PlaygroundMediaReference[],
  mode: VideoReferenceMode,
  limits: VideoReferenceLimits,
): PlaygroundMediaReference[] {
  if (mode === "frame") {
    return references
      .filter((item) => item.mediaType === "image")
      .slice(0, limits.frameImages);
  }
  return [...references];
}

type MediaReferenceProfile = {
  supportsFirstFrame?: boolean;
  supportsLastFrame?: boolean;
  supportsReferenceImages?: boolean;
  supportsReferenceVideos: boolean;
  supportsReferenceAudio: boolean;
  supportsOmniReference: boolean;
};

export function resolveMediaReferenceMode(
  profile: MediaReferenceProfile,
  mode: VideoReferenceMode,
): VideoReferenceMode {
  if (profile.supportsOmniReference && mode === "omni") {
    return "omni";
  }
  if (
    !profile.supportsFirstFrame &&
    !profile.supportsLastFrame &&
    profile.supportsReferenceImages
  ) {
    return "omni";
  }
  return "frame";
}

export function sanitizeMediaReferences(
  references: readonly PlaygroundMediaReference[],
  profile: MediaReferenceProfile,
  mode: VideoReferenceMode,
  limits: VideoReferenceLimits,
): PlaygroundMediaReference[] {
  const effectiveMode = resolveMediaReferenceMode(profile, mode);
  const next = filterMediaReferencesForMode(references, effectiveMode, limits);

  if (effectiveMode === "frame") {
    const framedByCapability =
      profile.supportsFirstFrame !== undefined ||
      profile.supportsLastFrame !== undefined;
    const maxFrames = framedByCapability
      ? Math.min(
          limits.frameImages,
          (profile.supportsFirstFrame ? 1 : 0) +
            (profile.supportsLastFrame ? 1 : 0),
        )
      : limits.frameImages;
    return next.slice(0, Math.max(0, maxFrames));
  }

  const result: PlaygroundMediaReference[] = [];
  const counts: Record<PlaygroundMediaType, number> = {
    image: 0,
    video: 0,
    audio: 0,
  };

  for (const item of next) {
    if (item.mediaType === "video" && !profile.supportsReferenceVideos) {
      continue;
    }
    if (item.mediaType === "audio" && !profile.supportsReferenceAudio) {
      continue;
    }
    const max =
      item.mediaType === "image"
        ? limits.images
        : item.mediaType === "video"
          ? limits.videos
          : limits.audio;
    if (max <= 0 || counts[item.mediaType] >= max) {
      continue;
    }
    counts[item.mediaType] += 1;
    result.push(item);
  }

  return result;
}

export function videoReferencesEnabled(
  profile: Pick<MediaReferenceProfile, "supportsOmniReference">,
  mode: VideoReferenceMode,
): boolean {
  return mode === "frame" || profile.supportsOmniReference;
}

export type VideoMediaUrlInput = {
  firstFrame?: string;
  lastFrame?: string;
  referenceImages?: string[];
  referenceVideos?: string[];
  referenceAudio?: string[];
};

export type VideoMediaFileInput = {
  firstFrame?: File;
  lastFrame?: File;
  referenceImages: File[];
  referenceVideos: File[];
  referenceAudio: File[];
};

function assignFrameSlot(
  item: PlaygroundMediaReference,
  urls: VideoMediaUrlInput,
  files: VideoMediaFileInput,
  slot: "firstFrame" | "lastFrame",
): void {
  if (item.sourceKind === "file" && item.file) {
    files[slot] = item.file;
    return;
  }
  if (item.sourceKind === "url" && item.url && !item.url.startsWith("data:")) {
    urls[slot] = item.url;
  }
}

export function splitVideoMediaReferences(
  references: readonly PlaygroundMediaReference[],
  mode: VideoReferenceMode,
): { urls: VideoMediaUrlInput; files: VideoMediaFileInput } {
  const urls: VideoMediaUrlInput = {};
  const files: VideoMediaFileInput = {
    referenceImages: [],
    referenceVideos: [],
    referenceAudio: [],
  };

  if (mode === "frame") {
    const images = references
      .filter((item) => item.mediaType === "image")
      .slice(0, MAX_FRAME_REFERENCE_IMAGES);
    if (images[0]) {
      assignFrameSlot(images[0], urls, files, "firstFrame");
    }
    if (images[1]) {
      assignFrameSlot(images[1], urls, files, "lastFrame");
    }
    return { urls, files };
  }

  for (const item of references) {
    if (item.sourceKind === "file" && item.file) {
      if (item.mediaType === "image") {
        files.referenceImages.push(item.file);
      } else if (item.mediaType === "video") {
        files.referenceVideos.push(item.file);
      } else {
        files.referenceAudio.push(item.file);
      }
      continue;
    }
    if (item.sourceKind === "url" && item.url && !item.url.startsWith("data:")) {
      if (item.mediaType === "image") {
        urls.referenceImages = [...(urls.referenceImages ?? []), item.url];
      } else if (item.mediaType === "video") {
        urls.referenceVideos = [...(urls.referenceVideos ?? []), item.url];
      } else {
        urls.referenceAudio = [...(urls.referenceAudio ?? []), item.url];
      }
    }
  }

  return { urls, files };
}

export function hasVideoMediaFiles(files: VideoMediaFileInput): boolean {
  return (
    Boolean(files.firstFrame) ||
    Boolean(files.lastFrame) ||
    files.referenceImages.length > 0 ||
    files.referenceVideos.length > 0 ||
    files.referenceAudio.length > 0
  );
}
