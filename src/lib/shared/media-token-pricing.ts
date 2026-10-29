import {
  computeQuantityCharge,
  computeMediaTokenCharge,
  isTokenPricingUnit,
  type ChargeResult,
  type PricingSnapshot,
} from "./pricing";
import type { UpstreamTokenUsage } from "./upstream-task-usage";
import {
  normalizeVideoResolution,
  parseVideoPriceTable,
  resolveVideoCharge,
  type PricingSnapshotWithTable,
  type VideoChargeInput,
  type VideoPriceTable,
} from "./video-pricing";

export { isTokenPricingUnit } from "./pricing";

export type EstimatedTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  promptTextTokens: number | null;
  promptImageTokens: number | null;
  completionTextTokens: number | null;
  completionImageTokens: number | null;
};

function emptyDetails(): Pick<
  EstimatedTokenUsage,
  | "promptTextTokens"
  | "promptImageTokens"
  | "completionTextTokens"
  | "completionImageTokens"
> {
  return {
    promptTextTokens: null,
    promptImageTokens: null,
    completionTextTokens: null,
    completionImageTokens: null,
  };
}

/** Prefer upstream usage; fill missing sides from heuristic; all-zero falls back (1c). */
export function pickChargeTokenUsage(
  usage: UpstreamTokenUsage | null | undefined,
  estimated: EstimatedTokenUsage,
): EstimatedTokenUsage {
  if (usage == null) {
    return estimated;
  }
  if (usage.promptTokens == null && usage.completionTokens == null) {
    return estimated;
  }
  const promptTokens = usage.promptTokens ?? estimated.promptTokens;
  const completionTokens = usage.completionTokens ?? estimated.completionTokens;
  if (promptTokens === 0 && completionTokens === 0) {
    return estimated;
  }
  return {
    promptTokens,
    completionTokens,
    promptTextTokens: usage.promptTextTokens,
    promptImageTokens: usage.promptImageTokens,
    completionTextTokens: usage.completionTextTokens,
    completionImageTokens: usage.completionImageTokens,
  };
}

const IMAGE_BASE_COMPLETION_TOKENS = 4096;
const IMAGE_REFERENCE_PIXELS = 1024 * 1024;

function parseImagePixelCount(size: string | null | undefined): number {
  if (!size) {
    return IMAGE_REFERENCE_PIXELS;
  }
  const match = size.trim().match(/^(\d+)\s*[x×]\s*(\d+)$/i);
  if (match) {
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return Math.floor(width * height);
    }
  }
  return IMAGE_REFERENCE_PIXELS;
}

/**
 * Heuristic image token budget for preflight / no-usage settle.
 * prompt ≈ promptLength; completion ≈ 4096 × (pixels / 1024²) × imageCount.
 * No details → settle bills all prompt at image-input rate.
 */
export function estimateImageTokenUsage(input: {
  imageCount: number;
  size?: string | null;
  promptLength?: number | null;
}): EstimatedTokenUsage {
  const imageCount = Math.max(1, Math.floor(input.imageCount) || 1);
  const pixels = parseImagePixelCount(input.size);
  const perImage = Math.max(
    1,
    Math.ceil(IMAGE_BASE_COMPLETION_TOKENS * (pixels / IMAGE_REFERENCE_PIXELS)),
  );
  const promptLength =
    typeof input.promptLength === "number" && Number.isFinite(input.promptLength)
      ? Math.max(0, Math.floor(input.promptLength))
      : 0;
  return {
    promptTokens: promptLength,
    completionTokens: perImage * imageCount,
    ...emptyDetails(),
  };
}

/** Completion tokens per second by resolution (heuristic 2c). */
const VIDEO_COMPLETION_TOKENS_PER_SECOND: Record<string, number> = {
  "480p": 2500,
  "720p": 5000,
  "768p": 5500,
  "1080p": 10000,
  "2k": 15000,
  "4k": 20000,
};

const VIDEO_DEFAULT_COMPLETION_TOKENS_PER_SECOND = 5000;

/**
 * Heuristic video token budget for preflight / no-usage settle.
 * prompt ≈ promptLength; completion ≈ tokensPerSecond(resolution) × seconds.
 */
export function estimateVideoTokenUsage(input: {
  seconds: number;
  resolution?: string | null;
  promptLength?: number | null;
}): EstimatedTokenUsage {
  const seconds =
    Number.isInteger(input.seconds) && input.seconds > 0 ? input.seconds : 5;
  const normalized =
    normalizeVideoResolution(input.resolution) ??
    input.resolution?.trim().toLowerCase() ??
    null;
  const tokensPerSecond =
    (normalized && VIDEO_COMPLETION_TOKENS_PER_SECOND[normalized]) ||
    VIDEO_DEFAULT_COMPLETION_TOKENS_PER_SECOND;
  const promptLength =
    typeof input.promptLength === "number" && Number.isFinite(input.promptLength)
      ? Math.max(0, Math.floor(input.promptLength))
      : 0;
  return {
    promptTokens: promptLength,
    completionTokens: tokensPerSecond * seconds,
    ...emptyDetails(),
  };
}

export type MediaChargeResult = ChargeResult & EstimatedTokenUsage;

export function resolveImageMediaCharge(
  pricing: PricingSnapshot,
  input: {
    imageCount: number;
    size?: string | null;
    promptLength?: number | null;
    usage?: UpstreamTokenUsage | null;
  },
): MediaChargeResult {
  const imageCount = Math.max(1, Math.floor(input.imageCount) || 1);
  if (isTokenPricingUnit(pricing.customerUnit)) {
    const estimated = estimateImageTokenUsage({
      imageCount,
      size: input.size,
      promptLength: input.promptLength,
    });
    const tokens = pickChargeTokenUsage(input.usage, estimated);
    return {
      ...computeMediaTokenCharge(pricing, tokens),
      ...tokens,
    };
  }
  const quantity = pricing.customerUnit === "request" ? 1 : imageCount;
  const charge = computeQuantityCharge(
    pricing,
    quantity,
    pricing.customerUnit === "request" ? undefined : (input.size ?? undefined),
  );
  return {
    ...charge,
    promptTokens: 0,
    completionTokens: 0,
    ...emptyDetails(),
  };
}

export function resolveVideoMediaCharge(
  pricing: PricingSnapshotWithTable,
  input: VideoChargeInput & {
    promptLength?: number | null;
    usage?: UpstreamTokenUsage | null;
  },
): MediaChargeResult {
  let table: VideoPriceTable | null = null;
  if (pricing.priceTable != null) {
    try {
      table =
        typeof pricing.priceTable === "object" &&
        pricing.priceTable !== null &&
        "mode" in pricing.priceTable &&
        "rates" in pricing.priceTable
          ? (pricing.priceTable as VideoPriceTable)
          : parseVideoPriceTable(pricing.priceTable);
    } catch {
      table = null;
    }
  }

  if (table?.mode === "per_token") {
    const estimated = estimateVideoTokenUsage({
      seconds: input.seconds,
      resolution: input.resolution,
      promptLength: input.promptLength,
    });
    const tokens = pickChargeTokenUsage(input.usage, estimated);
    const charge = resolveVideoCharge(
      { ...pricing, priceTable: table },
      {
        seconds: input.seconds,
        resolution: input.resolution,
        hasReference: input.hasReference,
        promptTokens: tokens.promptTokens,
        completionTokens: tokens.completionTokens,
      },
    );
    return {
      ...charge,
      ...tokens,
    };
  }

  if (isTokenPricingUnit(pricing.customerUnit)) {
    const estimated = estimateVideoTokenUsage({
      seconds: input.seconds,
      resolution: input.resolution,
      promptLength: input.promptLength,
    });
    const tokens = pickChargeTokenUsage(input.usage, estimated);
    return {
      ...computeMediaTokenCharge(pricing, tokens),
      ...tokens,
    };
  }
  const charge = resolveVideoCharge(pricing, input);
  return {
    ...charge,
    promptTokens: 0,
    completionTokens: 0,
    ...emptyDetails(),
  };
}
