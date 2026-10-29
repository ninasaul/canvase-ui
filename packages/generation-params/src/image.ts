import {
  getOpenAiImageMaxCount,
  getOpenAiImageSizes,
  getSeedreamReferenceLimit,
  getSeedreamSizeTiers,
  inferLockedImageAspectRatio,
  inferLockedImageAsync,
  inferLockedImageTier,
  migrateOpenAiPixelSizeToRatio,
  migrateSeedreamPixelSizeToRatio,
  OPENAI_GPT_IMAGE_BACKGROUND_OPTIONS,
  OPENAI_GPT_IMAGE_MODERATION_OPTIONS,
  OPENAI_GPT_IMAGE_QUALITY_OPTIONS,
  resolveImageFamily,
  resolveOpenAiImageVariant,
  resolveSeedreamPixelSize,
  resolveSeedreamVariant,
  SEEDREAM_ASPECT_RATIOS,
} from "./model-families";
import { stripPromptMentionTokens } from "./prompt-tokens";

export const IMAGE_RESPONSE_FORMATS = ["url", "b64_json"] as const;

export const DEFAULT_IMAGE_SIZES = [
  "1024x1024",
  "1024x1792",
  "1792x1024",
] as const;

/** Gemini / Banana: pixel or aspect-ratio strings accepted as public `size`. */
export const GEMINI_IMAGE_SIZES = [
  "1024x1024",
  "16:9",
  "9:16",
  "1:1",
] as const;

/** Model identity used by the image playground (from `GET /v1/models` id/vendor only). */
export type ImagePlaygroundModel = {
  id: string;
  vendor?: string | null;
  display_name?: string | null;
};

/** Public `/v1/images/generations` fields only. */
export type PlaygroundImageParams = {
  size: string;
  /** Seedream aspect ratio; combined with size tier → pixel `size` in request. */
  aspectRatio: string;
  count: string;
  responseFormat: string;
  async: boolean;
  quality: string;
  background: string;
  moderation: string;
};

export const DEFAULT_IMAGE_PARAMS: PlaygroundImageParams = {
  size: "1024x1024",
  aspectRatio: "1:1",
  count: "1",
  responseFormat: "url",
  async: false,
  quality: "auto",
  background: "auto",
  moderation: "auto",
};

export type ImageCapabilityProfile = {
  sizes: readonly string[];
  /** True only when size list is empty (fallback free-text; should be rare). */
  allowCustomSize: boolean;
  showCount: boolean;
  maxCount: number;
  showResponseFormat: boolean;
  showAsync: boolean;
  /** When set, async toggle is hidden and value is forced. */
  lockedAsync: boolean | null;
  showQuality: boolean;
  showBackground: boolean;
  showModeration: boolean;
  qualityOptions: readonly string[];
  backgroundOptions: readonly string[];
  moderationOptions: readonly string[];
  lockedImageTier: string | null;
  lockedAspectRatio: string | null;
  /** Seedream: show aspect-ratio chips alongside size tier. */
  showAspectRatio: boolean;
  aspectRatios: readonly string[];
  /** Soft UI hint: whether reference upload is offered. */
  supportsI2i: boolean;
  maxReferenceImages: number;
  /** Prefer tier chips (`2K`) over pixel / ratio shape icons. */
  sizeOptionStyle: "pixel" | "tier" | "ratio";
};

function looksLikePixelOrRatio(value: string): boolean {
  return (
    value === "auto" ||
    /^\d+x\d+$/i.test(value) ||
    /^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(value)
  );
}

function isRatioStyleSize(value: string): boolean {
  return value === "auto" || value.includes(":");
}

function isGptImageVariant(model: ImagePlaygroundModel): boolean {
  const variant = resolveOpenAiImageVariant(model);
  return variant === "gpt-image-1" || variant === "gpt-image-2";
}

function familyDefaultSizes(model: ImagePlaygroundModel): readonly string[] {
  const family = resolveImageFamily(model);
  const lockedAspectRatio = inferLockedImageAspectRatio(model);
  // GPT-image style: aspect ratio is the size control; hide when locked in model id.
  if (lockedAspectRatio && family !== "seedream") {
    return [];
  }

  switch (family) {
    case "seedream": {
      const tiers = getSeedreamSizeTiers(resolveSeedreamVariant(model));
      const lockedTier = inferLockedImageTier(model);
      return lockedTier ? [lockedTier] : tiers;
    }
    case "openai-image":
      return getOpenAiImageSizes(resolveOpenAiImageVariant(model));
    case "gemini-image":
      return GEMINI_IMAGE_SIZES;
    case "grok-image":
    case "generic":
    default:
      return DEFAULT_IMAGE_SIZES;
  }
}

function familyReferenceLimit(model: ImagePlaygroundModel): number {
  const family = resolveImageFamily(model);
  switch (family) {
    case "seedream":
      return getSeedreamReferenceLimit(resolveSeedreamVariant(model));
    case "openai-image": {
      const variant = resolveOpenAiImageVariant(model);
      // dall-e-3 is text-to-image only on the public OpenAI surface.
      return variant === "dall-e-3" ? 0 : 9;
    }
    case "gemini-image":
    case "grok-image":
      return 9;
    case "generic":
    default:
      // Pure API: offer refs; upstream rejects if unsupported.
      return 9;
  }
}

/** Accept size tokens for UI chips; reject pasted docs or junk. */
export function isValidImageSizeToken(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 32) {
    return false;
  }
  if (looksLikePixelOrRatio(trimmed)) {
    return true;
  }
  // Seedream-style tiers: 1K / 1.5K / 2K / 3K / 4K
  return /^\d+(?:\.\d+)?[Kk]$/.test(trimmed);
}

export function getImageReferenceLimit(model: ImagePlaygroundModel): number {
  return getImageCapabilityProfile(model).maxReferenceImages;
}

export function getImageCapabilityProfile(
  model: ImagePlaygroundModel,
): ImageCapabilityProfile {
  const sizes = familyDefaultSizes(model);
  const family = resolveImageFamily(model);
  const maxReferenceImages = familyReferenceLimit(model);
  const lockedImageTier = inferLockedImageTier(model);
  const lockedAspectRatio = inferLockedImageAspectRatio(model);
  const lockedAsync = inferLockedImageAsync(model);
  const gptImage = family === "openai-image" && isGptImageVariant(model);

  let maxCount = 10;
  if (family === "openai-image") {
    maxCount = getOpenAiImageMaxCount(resolveOpenAiImageVariant(model));
  }

  const sizeOptionStyle: ImageCapabilityProfile["sizeOptionStyle"] =
    sizes.length > 0 && sizes.every(isRatioStyleSize)
      ? "ratio"
      : sizes.every(looksLikePixelOrRatio)
        ? "pixel"
        : "tier";

  return {
    sizes,
    allowCustomSize: sizes.length === 0 && !lockedAspectRatio,
    showCount: maxCount > 1,
    maxCount,
    showResponseFormat: true,
    showAsync: lockedAsync === null,
    lockedAsync,
    showQuality: gptImage,
    showBackground: gptImage,
    showModeration: gptImage,
    qualityOptions: gptImage ? OPENAI_GPT_IMAGE_QUALITY_OPTIONS : [],
    backgroundOptions: gptImage ? OPENAI_GPT_IMAGE_BACKGROUND_OPTIONS : [],
    moderationOptions: gptImage ? OPENAI_GPT_IMAGE_MODERATION_OPTIONS : [],
    lockedImageTier,
    lockedAspectRatio,
    showAspectRatio: family === "seedream" && lockedAspectRatio === null,
    aspectRatios: family === "seedream" ? SEEDREAM_ASPECT_RATIOS : [],
    supportsI2i: maxReferenceImages > 0,
    maxReferenceImages,
    sizeOptionStyle,
  };
}

function pickAllowed<T extends string>(
  value: string,
  allowed: readonly T[],
  fallback: T,
): T {
  return (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function defaultImageSize(profile: ImageCapabilityProfile): string {
  if (profile.lockedAspectRatio && profile.sizeOptionStyle === "ratio") {
    return profile.lockedAspectRatio;
  }
  if (profile.sizes.includes("1:1")) {
    return "1:1";
  }
  if (profile.sizes.includes("2K")) {
    return "2K";
  }
  if (profile.sizes.includes("1024x1024")) {
    return "1024x1024";
  }
  if (profile.sizes.includes("auto")) {
    return "auto";
  }
  return profile.sizes[0] ?? "1024x1024";
}

export function sanitizeImageParams(
  model: ImagePlaygroundModel,
  params: PlaygroundImageParams,
): PlaygroundImageParams {
  const profile = getImageCapabilityProfile(model);
  const family = resolveImageFamily(model);
  const defaultSize = defaultImageSize(profile);

  let rawSize = params.size ?? "";
  let rawAspectRatio = params.aspectRatio ?? "1:1";

  if (profile.sizeOptionStyle === "ratio") {
    rawSize = migrateOpenAiPixelSizeToRatio(rawSize);
  } else if (family === "seedream") {
    const migratedRatio = migrateSeedreamPixelSizeToRatio(rawSize);
    if (migratedRatio) {
      rawAspectRatio = migratedRatio;
      rawSize =
        profile.lockedImageTier ??
        (profile.sizes.includes("2K") ? "2K" : defaultSize);
    } else if ((SEEDREAM_ASPECT_RATIOS as readonly string[]).includes(rawSize)) {
      rawAspectRatio = rawSize;
      rawSize =
        profile.lockedImageTier ??
        (profile.sizes.includes("2K") ? "2K" : defaultSize);
    }
  }

  const size =
    profile.allowCustomSize || profile.sizes.length === 0
      ? rawSize.trim() || defaultSize
      : pickAllowed(rawSize, profile.sizes, defaultSize);

  const aspectRatio = profile.lockedAspectRatio
    ? profile.lockedAspectRatio
    : profile.showAspectRatio
      ? pickAllowed(rawAspectRatio || "1:1", profile.aspectRatios, "1:1")
      : "1:1";

  const asyncValue =
    profile.lockedAsync !== null ? profile.lockedAsync : Boolean(params.async);

  return {
    size,
    aspectRatio,
    count: String(
      Math.min(
        Math.max(1, Number.parseInt(params.count, 10) || 1),
        profile.maxCount,
      ),
    ),
    responseFormat: pickAllowed(
      params.responseFormat,
      IMAGE_RESPONSE_FORMATS,
      "url",
    ),
    async: asyncValue,
    quality: profile.showQuality
      ? pickAllowed(params.quality, profile.qualityOptions, "auto")
      : "auto",
    background: profile.showBackground
      ? pickAllowed(params.background, profile.backgroundOptions, "auto")
      : "auto",
    moderation: profile.showModeration
      ? pickAllowed(params.moderation, profile.moderationOptions, "auto")
      : "auto",
  };
}

function collectReferenceImages(input: {
  referenceImage?: string;
  referenceImages?: string[];
}): string[] {
  const refs: string[] = [];
  if (input.referenceImage?.trim()) {
    refs.push(input.referenceImage.trim());
  }
  if (input.referenceImages) {
    for (const item of input.referenceImages) {
      const trimmed = item.trim();
      if (trimmed && !refs.includes(trimmed)) {
        refs.push(trimmed);
      }
    }
  }
  return refs;
}

function applyOpenAiSizeFields(
  body: Record<string, unknown>,
  size: string,
  profile: ImageCapabilityProfile,
): void {
  const effectiveSize = profile.lockedAspectRatio ?? size;
  if (!effectiveSize || effectiveSize === "auto") {
    return;
  }
  if (effectiveSize.includes(":")) {
    body.aspect_ratio = effectiveSize;
    return;
  }
  body.size = effectiveSize;
}

export function buildImageRequestBody(
  model: ImagePlaygroundModel,
  params: PlaygroundImageParams,
  input: {
    modelId: string;
    prompt: string;
    referenceImage?: string;
    referenceImages?: string[];
  },
): Record<string, unknown> {
  const sanitized = sanitizeImageParams(model, params);
  const profile = getImageCapabilityProfile(model);
  const body: Record<string, unknown> = {
    model: input.modelId,
    prompt: stripPromptMentionTokens(input.prompt),
    n: Math.max(1, Number.parseInt(sanitized.count, 10) || 1),
    response_format: sanitized.responseFormat,
  };

  const family = resolveImageFamily(model);
  if (family === "openai-image" && isGptImageVariant(model)) {
    applyOpenAiSizeFields(body, sanitized.size, profile);
  } else if (family === "seedream") {
    const tier = profile.lockedImageTier ?? sanitized.size;
    const ratio = profile.lockedAspectRatio ?? sanitized.aspectRatio;
    const pixels = resolveSeedreamPixelSize(tier, ratio);
    body.size = pixels ?? tier;
  } else if (sanitized.size) {
    body.size = sanitized.size;
  }

  if (sanitized.async) {
    body.async = true;
  }

  if (profile.showQuality && sanitized.quality !== "auto") {
    body.quality = sanitized.quality;
  }
  if (profile.showBackground && sanitized.background !== "auto") {
    body.background = sanitized.background;
  }
  if (profile.showModeration && sanitized.moderation !== "auto") {
    body.moderation = sanitized.moderation;
  }

  if (profile.maxReferenceImages > 0) {
    const refs = collectReferenceImages(input).slice(
      0,
      profile.maxReferenceImages,
    );
    if (refs.length === 1) {
      body.image = refs[0];
    } else if (refs.length > 1) {
      body.images = refs;
    }
  }

  return body;
}

export function toImagePlaygroundModel(
  model:
    | {
        id: string;
        vendor?: string | null;
        display_name?: string;
      }
    | undefined,
): ImagePlaygroundModel {
  if (!model) {
    return { id: "" };
  }
  return {
    id: model.id,
    vendor: model.vendor,
    display_name: model.display_name,
  };
}
