export type ImageModelFamily =
  | "seedream"
  | "gemini-image"
  | "openai-image"
  | "grok-image"
  | "generic";

export type VideoModelFamily =
  | "seedance"
  | "minimax-h3"
  | "kling"
  | "video-ultra"
  | "wan3"
  | "generic";

export type ModelIdentity = {
  id: string;
  vendor?: string | null;
  display_name?: string | null;
};

function haystack(model: ModelIdentity | string): string {
  if (typeof model === "string") {
    return model.trim().toLowerCase();
  }
  return [model.id, model.vendor, model.display_name]
    .filter(Boolean)
    .join(" ")
    .trim()
    .toLowerCase();
}

const GEMINI_IMAGE_PATTERN =
  /flash-image|pro-image|image-preview|gemini.*image|imagen|banana|nano-?banana/i;

const OPENAI_IMAGE_PATTERN = /gpt-image|dall-?e/i;

const GROK_IMAGE_PATTERN = /grok.*image|aurora/i;

export type SeedreamVariant = "pro" | "pro-ep" | "lite" | "four-five" | "generic";

export function isSeedreamModel(model: ModelIdentity | string): boolean {
  return haystack(model).includes("seedream");
}

/** Seedream model line for playground params (size tiers, refs, sequential, etc.). */
export function resolveSeedreamVariant(
  model: ModelIdentity | string,
): SeedreamVariant {
  const normalized = haystack(model).replace(/_/g, "-");
  if (normalized.includes("lite")) {
    return "lite";
  }
  if (/(?:^|[-.])4[-.]5(?:[-.]|$)/.test(normalized) || normalized.includes("4-5")) {
    return "four-five";
  }
  if (/(?:^|[-.])ep(?:[-.]|$)/.test(normalized) || normalized.includes("pro-ep")) {
    return "pro-ep";
  }
  if (normalized.includes("5-0-pro") || normalized.includes("5.0-pro")) {
    return "pro";
  }
  return "generic";
}

export function getSeedreamSizeTiers(variant: SeedreamVariant): readonly string[] {
  switch (variant) {
    case "lite":
      return ["2K", "3K", "4K"];
    case "four-five":
      return ["2K", "4K"];
    case "pro":
    case "pro-ep":
      return ["1K", "1.5K", "2K"];
    default:
      return ["1K", "1.5K", "2K", "3K", "4K"];
  }
}

export function getSeedreamReferenceLimit(variant: SeedreamVariant): number {
  switch (variant) {
    case "lite":
    case "four-five":
      return 14;
    case "pro":
    case "pro-ep":
      return 10;
    default:
      return 10;
  }
}


/** Seedream aspect ratios shown in playground (mapped to pixels by tier). */
export const SEEDREAM_ASPECT_RATIOS = [
  "1:1",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
  "3:2",
  "2:3",
  "21:9",
] as const;

export type SeedreamAspectRatio = (typeof SEEDREAM_ASPECT_RATIOS)[number];
export type SeedreamSizeTier = "1K" | "1.5K" | "2K" | "3K" | "4K";

/** Official Seedream pixel presets by tier × aspect ratio. */
export const SEEDREAM_TIER_ASPECT_PIXELS: Record<
  "1K" | "1.5K" | "2K",
  Record<SeedreamAspectRatio, string>
> = {
  "1K": {
    "1:1": "1024x1024",
    "4:3": "1152x864",
    "3:4": "864x1152",
    "16:9": "1424x800",
    "9:16": "800x1424",
    "3:2": "1248x832",
    "2:3": "832x1248",
    "21:9": "1568x672",
  },
  "1.5K": {
    "1:1": "1536x1536",
    "4:3": "1792x1344",
    "3:4": "1344x1792",
    "16:9": "2048x1152",
    "9:16": "1152x2048",
    "3:2": "1872x1248",
    "2:3": "1248x1872",
    "21:9": "2352x1008",
  },
  "2K": {
    "1:1": "2048x2048",
    "4:3": "2368x1776",
    "3:4": "1776x2368",
    "16:9": "2816x1584",
    "9:16": "1584x2816",
    "3:2": "2496x1664",
    "2:3": "1664x2496",
    "21:9": "3136x1344",
  },
};

function scaleSeedreamPixelSize(size: string, factor: number): string {
  const match = /^(\d+)x(\d+)$/i.exec(size.trim());
  if (!match) {
    return size;
  }
  const width = Math.round(Number(match[1]) * factor);
  const height = Math.round(Number(match[2]) * factor);
  // Keep even dimensions for codec / upstream friendliness.
  const even = (n: number) => (n % 2 === 0 ? n : n + 1);
  return `${even(width)}x${even(height)}`;
}

/** Map Seedream size tier + aspect ratio to a concrete `size` pixel string. */
export function resolveSeedreamPixelSize(
  tier: string,
  aspectRatio: string,
): string | null {
  const ratio = (SEEDREAM_ASPECT_RATIOS as readonly string[]).includes(aspectRatio)
    ? (aspectRatio as SeedreamAspectRatio)
    : null;
  if (!ratio) {
    return null;
  }

  const normalizedTier = tier.trim().toUpperCase().replace(/Ｋ/g, "K");
  if (normalizedTier === "1K" || normalizedTier === "1.5K" || normalizedTier === "2K") {
    return SEEDREAM_TIER_ASPECT_PIXELS[normalizedTier][ratio];
  }
  // 3K / 4K are not in the official table; scale from 2K.
  const base = SEEDREAM_TIER_ASPECT_PIXELS["2K"][ratio];
  if (normalizedTier === "3K") {
    return scaleSeedreamPixelSize(base, 1.5);
  }
  if (normalizedTier === "4K") {
    return scaleSeedreamPixelSize(base, 2);
  }
  return null;
}

/** Reverse-map a Seedream pixel size back to aspect ratio (draft migration). */
export function migrateSeedreamPixelSizeToRatio(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  for (const tier of Object.values(SEEDREAM_TIER_ASPECT_PIXELS)) {
    for (const [ratio, pixels] of Object.entries(tier)) {
      if (pixels.toLowerCase() === normalized) {
        return ratio;
      }
    }
  }
  return null;
}


export function isGeminiImageModel(model: ModelIdentity | string): boolean {
  return GEMINI_IMAGE_PATTERN.test(haystack(model));
}

export type OpenAiImageVariant =
  | "gpt-image-1"
  | "gpt-image-2"
  | "dall-e-2"
  | "dall-e-3"
  | "generic";

/** OpenAI image line for playground params (size, n, quality, etc.). */
export function resolveOpenAiImageVariant(
  model: ModelIdentity | string,
): OpenAiImageVariant {
  const normalized = haystack(model).replace(/_/g, "-");
  if (normalized.includes("dall-e-3") || normalized.includes("dalle-3")) {
    return "dall-e-3";
  }
  if (normalized.includes("dall-e-2") || normalized.includes("dalle-2")) {
    return "dall-e-2";
  }
  if (
    /(?:^|[-.])gpt-image-1(?:[-.]|$)/.test(normalized) ||
    normalized.endsWith("gpt-image-1")
  ) {
    return "gpt-image-1";
  }
  if (normalized.includes("gpt-image-2") || normalized.includes("gpt-image")) {
    return "gpt-image-2";
  }
  if (normalized.includes("dall-e") || normalized.includes("dalle")) {
    return "dall-e-3";
  }
  return "generic";
}

/** GPT Image aspect ratios shown in playground; sent as public `aspect_ratio`. */
export const OPENAI_GPT_IMAGE_ASPECT_RATIOS = [
  "auto",
  "1:1",
  "16:9",
  "9:16",
  "3:2",
  "2:3",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "21:9",
] as const;

export const OPENAI_GPT_IMAGE_QUALITY_OPTIONS = [
  "auto",
  "low",
  "medium",
  "high",
] as const;

export const OPENAI_GPT_IMAGE_BACKGROUND_OPTIONS = [
  "auto",
  "opaque",
  "transparent",
] as const;

export const OPENAI_GPT_IMAGE_MODERATION_OPTIONS = ["auto", "low"] as const;

const GPT_IMAGE_ASPECT_RATIO_ALIASES: Record<string, string> = {
  "1x1": "1:1",
  "1-1": "1:1",
  "16x9": "16:9",
  "16-9": "16:9",
  "9x16": "9:16",
  "9-16": "9:16",
  "3x2": "3:2",
  "3-2": "3:2",
  "2x3": "2:3",
  "2-3": "2:3",
  "3x4": "3:4",
  "3-4": "3:4",
  "4x3": "4:3",
  "4-3": "4:3",
  "4x5": "4:5",
  "4-5": "4:5",
  "5x4": "5:4",
  "5-4": "5:4",
  "21x9": "21:9",
  "21-9": "21:9",
};

function normalizeAspectRatioToken(token: string): string {
  const lower = token.trim().toLowerCase();
  const aliased = GPT_IMAGE_ASPECT_RATIO_ALIASES[lower];
  if (aliased) {
    return aliased;
  }
  if (token.includes(":")) {
    return token;
  }
  return token.replace(/x/i, ":").replace(/-/g, ":");
}

/** Size tier locked by model id token, e.g. `gpt-image-2-2K`, `Banana-pro-4k`. */
export function inferLockedImageTier(model: ModelIdentity | string): string | null {
  const normalized = haystack(model).replace(/_/g, "-");
  const match = normalized.match(/(?:^|[-.])(1k|1\.5k|2k|4k)(?:$|[-.])/i);
  if (!match?.[1]) {
    return null;
  }
  const token = match[1].toLowerCase();
  if (token === "1k") {
    return "1K";
  }
  if (token === "1.5k") {
    return "1.5K";
  }
  if (token === "2k") {
    return "2K";
  }
  if (token === "4k") {
    return "4K";
  }
  return null;
}

/** Aspect ratio locked by model id token, e.g. `…-16x9`, `…-9-16`. */
export function inferLockedImageAspectRatio(
  model: ModelIdentity | string,
): string | null {
  const normalized = haystack(model).replace(/_/g, "-");
  const match = normalized.match(
    /(?:^|[-.])(21x9|21-9|16x9|16-9|9x16|9-16|1x1|1-1|3x2|3-2|2x3|2-3|3x4|3-4|4x3|4-3|4x5|4-5|5x4|5-4)(?:$|[-.])/i,
  );
  if (!match?.[1]) {
    return null;
  }
  return normalizeAspectRatioToken(match[1]);
}

/** `-sync` model aliases force synchronous generation (`async: false`). */
export function inferLockedImageAsync(
  model: ModelIdentity | string,
): boolean | null {
  const normalized = haystack(model).replace(/_/g, "-");
  if (/(?:^|[-.])sync(?:$|[-.])/i.test(normalized)) {
    return false;
  }
  return null;
}

/** Map legacy GPT Image pixel presets to aspect ratios for saved drafts. */
export function migrateOpenAiPixelSizeToRatio(value: string): string {
  switch (value.trim().toLowerCase()) {
    case "1024x1024":
      return "1:1";
    case "1536x1024":
      return "3:2";
    case "1024x1536":
      return "2:3";
    default:
      return value;
  }
}

export function getOpenAiImageSizes(
  variant: OpenAiImageVariant,
): readonly string[] {
  switch (variant) {
    case "dall-e-2":
      return ["256x256", "512x512", "1024x1024"];
    case "dall-e-3":
      return ["1024x1024", "1792x1024", "1024x1792"];
    case "gpt-image-1":
    case "gpt-image-2":
      return OPENAI_GPT_IMAGE_ASPECT_RATIOS;
    case "generic":
    default:
      return ["auto", "1024x1024", "1536x1024", "1024x1536"];
  }
}

export function getOpenAiImageMaxCount(variant: OpenAiImageVariant): number {
  return variant === "dall-e-3" ? 1 : 10;
}

export function isOpenAiImageModel(model: ModelIdentity | string): boolean {
  return OPENAI_IMAGE_PATTERN.test(haystack(model));
}

export function isGrokImageModel(model: ModelIdentity | string): boolean {
  return GROK_IMAGE_PATTERN.test(haystack(model));
}

export function resolveImageFamily(model: ModelIdentity | string): ImageModelFamily {
  if (isSeedreamModel(model)) {
    return "seedream";
  }
  if (isGeminiImageModel(model)) {
    return "gemini-image";
  }
  if (isOpenAiImageModel(model)) {
    return "openai-image";
  }
  if (isGrokImageModel(model)) {
    return "grok-image";
  }
  return "generic";
}

export function isSeedanceVideoModel(model: ModelIdentity | string): boolean {
  const normalized = haystack(model);
  return (
    normalized.includes("seedance") ||
    normalized.includes("seeddance") ||
    normalized.includes("dreamina-seedance") ||
    normalized.includes("dreamina-seeddance")
  );
}

export function isMiniMaxVideoModel(model: ModelIdentity | string): boolean {
  const normalized = haystack(model);
  return normalized.includes("minimax") || normalized.includes("hailuo");
}

/** MiniMax-H3-Max：快速版，仅 T2V / I2V，无参考生。 */
export function isMiniMaxH3MaxModel(model: ModelIdentity | string): boolean {
  if (!isMiniMaxVideoModel(model)) {
    return false;
  }
  const normalized = haystack(model).replace(/_/g, "-");
  return (
    normalized.includes("h3-max") ||
    normalized.includes("minimax-h3max") ||
    /\bh3max\b/.test(normalized)
  );
}

export function isKlingVideoModel(model: ModelIdentity | string): boolean {
  const normalized = haystack(model);
  return normalized.includes("kling") || normalized.includes("keling");
}

export function isVideoUltraModel(model: ModelIdentity | string): boolean {
  return haystack(model).includes("video-ultra");
}

export function isWan3VideoModel(model: ModelIdentity | string): boolean {
  const normalized = haystack(model).replace(/_/g, "-");
  return (
    normalized.includes("wan3.0") ||
    normalized.includes("wan3-0") ||
    /(?:^|[-.])wan3(?:\.|-)?0(?:[-.]|$)/.test(normalized)
  );
}

/** wan3.0-image*：图生专用，不支持参考视频. */
export function isWan3ImageOnlyModel(model: ModelIdentity | string): boolean {
  if (!isWan3VideoModel(model)) {
    return false;
  }
  const normalized = haystack(model).replace(/_/g, "-");
  return (
    normalized.includes("wan3.0-image") || normalized.includes("wan3-0-image")
  );
}

export function resolveVideoFamily(model: ModelIdentity | string): VideoModelFamily {
  if (isMiniMaxVideoModel(model)) {
    return "minimax-h3";
  }
  if (isKlingVideoModel(model)) {
    return "kling";
  }
  if (isSeedanceVideoModel(model)) {
    return "seedance";
  }
  if (isVideoUltraModel(model)) {
    return "video-ultra";
  }
  if (isWan3VideoModel(model)) {
    return "wan3";
  }
  return "generic";
}

/** Seedance 2.0 / 2.5 line (duration / draft / higher caps); omni UI is on for all Seedance. */
export function isSeedance2Model(model: ModelIdentity | string): boolean {
  return isSeedance20Model(model) || isSeedance25Model(model);
}

export function isSeedance20Model(model: ModelIdentity | string): boolean {
  if (!isSeedanceVideoModel(model) || isSeedance25Model(model)) {
    return false;
  }
  const normalized = haystack(model).replace(/_/g, "-");
  return (
    /(?:^|[-.])(?:2(?:\.|-)?0|2\.0)(?:[-.]|$)/.test(normalized) ||
    /seedance\s*2(?:\.|-)?0/.test(normalized) ||
    /dreamina-seedance-2-0/.test(normalized)
  );
}

/** Seedance 2.5: longer duration (4–30s) vs 2.0 (4–15s), higher omni-reference limits. */
export function isSeedance25Model(model: ModelIdentity | string): boolean {
  const normalized = haystack(model).replace(/_/g, "-");
  return (
    /(?:^|[-.])(?:2(?:\.|-)?5|2\.5)(?:[-.]|$)/.test(normalized) ||
    /seedance\s*2(?:\.|-)?5/.test(normalized)
  );
}

/** Duration locked by model id token, e.g. `…-15s`, `…-30s`. */
export function inferLockedDuration(model: ModelIdentity | string): number | null {
  const normalized = haystack(model).replace(/_/g, "-");
  const match = normalized.match(/(?:^|[-.])(\d{1,3})s(?:$|[-.])/);
  if (!match?.[1]) {
    return null;
  }
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeLockedResolution(token: string): string {
  const lower = token.toLowerCase();
  if (lower === "4k") {
    return "4k";
  }
  if (lower === "2k") {
    return "2K";
  }
  if (lower === "768p") {
    return "768P";
  }
  if (/^\d+p$/.test(lower)) {
    return lower;
  }
  if (lower === "480" || lower === "720" || lower === "1080") {
    return `${lower}p`;
  }
  return lower;
}

/** Resolution locked by model id token, e.g. `…-720p`, `…-480-`, `…-4k`. */
export function inferLockedResolution(model: ModelIdentity | string): string | null {
  const normalized = haystack(model).replace(/_/g, "-");

  const explicit = normalized.match(
    /(?:^|[-.])(480p|720p|1080p|768p|4k|2k)(?:$|[-.])/,
  );
  if (explicit?.[1]) {
    return normalizeLockedResolution(explicit[1]);
  }

  const bare = normalized.match(/(?:^|[-.])(480|720|1080)(?:$|[-.])/);
  if (bare?.[1]) {
    return normalizeLockedResolution(bare[1]);
  }

  return null;
}
