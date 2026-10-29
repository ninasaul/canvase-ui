import {
  computeQuantityCharge,
  computeTokenCharge,
  type ChargeResult,
  type PricingSnapshot,
} from "./pricing";

export const videoResolutions = [
  "480p",
  "720p",
  "1080p",
  "4k",
  "768p",
  "2k",
] as const;
export type VideoResolution = (typeof videoResolutions)[number];

/** Reference-presence axis for per_token price tables. */
export const videoRefKeys = ["NO_REF", "WITH_REF"] as const;
export type VideoRefKey = (typeof videoRefKeys)[number];

export const videoPriceTableModes = [
  "per_second",
  "per_resolution",
  "fixed",
  "per_token",
] as const;
export type VideoPriceTableMode = (typeof videoPriceTableModes)[number];

function isVideoPriceTableMode(value: unknown): value is VideoPriceTableMode {
  return (
    value === "per_second" ||
    value === "per_resolution" ||
    value === "fixed" ||
    value === "per_token"
  );
}

function isRefKey(key: string): boolean {
  return key === "NO_REF" || key === "WITH_REF" || key === "*";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function resolveVideoRefKey(hasReference?: boolean): VideoRefKey {
  return hasReference ? "WITH_REF" : "NO_REF";
}

/** Whether a video request carries any reference / frame media. */
export function videoHasReferenceMedia(input: {
  image?: unknown;
  first_frame?: unknown;
  last_frame?: unknown;
  reference_images?: unknown;
  reference_videos?: unknown;
  reference_audio?: unknown;
  imageUrl?: unknown;
  lastFrameUrl?: unknown;
  referenceImages?: unknown;
  referenceVideos?: unknown;
  referenceAudio?: unknown;
}): boolean {
  const image = input.image ?? input.imageUrl;
  if (typeof image === "string" && image.trim()) {
    return true;
  }
  if (isRecord(image) && typeof image.url === "string" && image.url.trim()) {
    return true;
  }
  for (const candidate of [
    input.first_frame,
    input.last_frame,
    input.imageUrl,
    input.lastFrameUrl,
  ]) {
    if (typeof candidate === "string" && candidate.trim()) {
      return true;
    }
  }
  for (const list of [
    input.reference_images,
    input.reference_videos,
    input.reference_audio,
    input.referenceImages,
    input.referenceVideos,
    input.referenceAudio,
  ]) {
    if (Array.isArray(list) && list.length > 0) {
      return true;
    }
  }
  return false;
}

export type VideoPriceRate = {
  customer: string;
  upstream: string;
};

export type VideoPriceTable = {
  mode: VideoPriceTableMode;
  rates: Partial<
    Record<
      VideoResolution | "*",
      Partial<Record<string, VideoPriceRate>>
    >
  >;
};

/** Logo stems accepted as Model.vendor values. */
export const modelVendorIds = [
  "Antigravity",
  "Apple Intelligent",
  "ChatGPT",
  "Claude",
  "Codex",
  "Cohere",
  "DeepSeek",
  "Fireworks AI",
  "Gemini",
  "Grok",
  "Hugging Face",
  "Kimi",
  "Microsoft Copilot",
  "Mid Journey",
  "MiniMax",
  "Mistral AI",
  "Notion",
  "Poe",
  "Qwen",
  "azure",
  "bigmodel",
  "bytedance",
  "happyhorse",
  "kling",
  "manus",
  "meta",
  "ollama",
  "perplexity",
  "runway",
  "sora",
  "stability.ai",
  "suno",
] as const;

export type ModelVendorId = (typeof modelVendorIds)[number];

const vendorIdSet = new Set<string>(modelVendorIds);
const resolutionSet = new Set<string>(videoResolutions);

export function isVideoResolution(value: string): value is VideoResolution {
  return resolutionSet.has(value);
}

export function isModelVendorId(value: string): value is ModelVendorId {
  return vendorIdSet.has(value);
}

export function normalizeVideoResolution(
  value: string | null | undefined,
): VideoResolution | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  if (isVideoResolution(trimmed)) {
    return trimmed;
  }
  return null;
}

function isDecimalString(value: unknown): value is string {
  return typeof value === "string" && /^-?\d+(\.\d{1,6})?$/.test(value.trim());
}

function parseRate(value: unknown, label: string): VideoPriceRate {
  if (!isRecord(value)) {
    throw new Error(`${label} 必须是对象`);
  }
  if (!isDecimalString(value.customer)) {
    throw new Error(`${label}.customer 必须是合法金额字符串`);
  }
  if (!isDecimalString(value.upstream)) {
    throw new Error(`${label}.upstream 必须是合法金额字符串`);
  }
  return {
    customer: value.customer.trim(),
    upstream: value.upstream.trim(),
  };
}

function isDurationKey(key: string): boolean {
  if (key === "*") {
    return true;
  }
  const parsed = Number(key);
  return Number.isInteger(parsed) && parsed > 0 && String(parsed) === key;
}

/** Parse and validate a priceTable JSON value. Returns null for empty/absent. */
export function parseVideoPriceTable(
  value: unknown,
  label = "priceTable",
): VideoPriceTable | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!isRecord(value)) {
    throw new Error(`${label} 必须是对象`);
  }
  const mode = value.mode;
  if (!isVideoPriceTableMode(mode)) {
    throw new Error(
      `${label}.mode 必须是 per_second、per_resolution、fixed 或 per_token`,
    );
  }
  if (!isRecord(value.rates)) {
    throw new Error(`${label}.rates 必须是对象`);
  }

  const rates: VideoPriceTable["rates"] = {};
  for (const [resolutionKey, durationMap] of Object.entries(value.rates)) {
    const normalizedResolution: VideoResolution | "*" | null =
      resolutionKey === "*"
        ? "*"
        : normalizeVideoResolution(resolutionKey);
    if (!normalizedResolution) {
      throw new Error(
        `${label}.rates 分辨率必须是 ${videoResolutions.join("|")} 或 *`,
      );
    }
    if (!isRecord(durationMap)) {
      throw new Error(`${label}.rates.${resolutionKey} 必须是对象`);
    }
    const parsedDurations: Partial<Record<string, VideoPriceRate>> = {};
    for (const [durationKey, rate] of Object.entries(durationMap)) {
      if (mode === "per_token") {
        if (!isRefKey(durationKey)) {
          throw new Error(
            `${label}.rates.${resolutionKey}：per_token 键必须是 NO_REF、WITH_REF 或 *`,
          );
        }
      } else if (mode === "per_resolution") {
        if (durationKey !== "*") {
          throw new Error(
            `${label}.rates.${resolutionKey}：per_resolution 时长键只能是 *`,
          );
        }
      } else if (!isDurationKey(durationKey)) {
        throw new Error(
          `${label}.rates.${resolutionKey} 时长键必须是正整数秒或 *`,
        );
      }
      parsedDurations[durationKey] = parseRate(
        rate,
        `${label}.rates.${resolutionKey}.${durationKey}`,
      );
    }
    if (mode === "per_resolution" && !parsedDurations["*"]) {
      throw new Error(
        `${label}.rates.${resolutionKey}：per_resolution 必须包含 * 单价`,
      );
    }
    rates[normalizedResolution] = parsedDurations;
  }

  if (Object.keys(rates).length === 0) {
    throw new Error(`${label}.rates 不能为空`);
  }

  return { mode, rates };
}

function lookupRate(
  table: VideoPriceTable,
  resolution: VideoResolution | null,
  seconds: number,
  hasReference?: boolean,
): VideoPriceRate | null {
  const resolutionKeys: Array<VideoResolution | "*"> = resolution
    ? [resolution, "*"]
    : ["*"];
  const durationKeys =
    table.mode === "per_token"
      ? ([resolveVideoRefKey(hasReference), "*"] as const)
      : table.mode === "per_resolution"
        ? (["*"] as const)
        : ([String(seconds), "*"] as const);

  for (const resKey of resolutionKeys) {
    const durationMap = table.rates[resKey];
    if (!durationMap) {
      continue;
    }
    for (const durKey of durationKeys) {
      const rate = durationMap[durKey];
      if (rate) {
        return rate;
      }
    }
  }
  return null;
}

export type VideoChargeInput = {
  seconds: number;
  resolution?: string | null;
  /** When true, per_token tables use WITH_REF rates. */
  hasReference?: boolean;
  /**
   * Billable tokens for per_token mode (usually completion/total from upstream).
   * If omitted, resolveVideoCharge cannot settle per_token (use resolveVideoMediaCharge).
   */
  billableTokens?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
};

export type PricingSnapshotWithTable = PricingSnapshot & {
  priceTable?: VideoPriceTable | null | unknown;
};

/**
 * Resolve video charge from priceTable when present; otherwise legacy
 * quantity × sizeMultipliers.
 */
export function resolveVideoCharge(
  pricing: PricingSnapshotWithTable,
  input: VideoChargeInput,
): ChargeResult {
  const seconds =
    Number.isInteger(input.seconds) && input.seconds > 0 ? input.seconds : 5;
  const resolution = normalizeVideoResolution(input.resolution ?? undefined);

  let table: VideoPriceTable | null = null;
  if (pricing.priceTable != null) {
    table =
      typeof pricing.priceTable === "object" &&
      pricing.priceTable !== null &&
      "mode" in pricing.priceTable &&
      "rates" in pricing.priceTable &&
      (pricing.priceTable as VideoPriceTable).mode &&
      (pricing.priceTable as VideoPriceTable).rates
        ? (pricing.priceTable as VideoPriceTable)
        : parseVideoPriceTable(pricing.priceTable);
  }

  if (!table) {
    const quantity =
      pricing.customerUnit === "request" || pricing.customerUnit === "image"
        ? 1
        : seconds;
    return computeQuantityCharge(
      pricing,
      quantity,
      resolution ?? input.resolution ?? undefined,
    );
  }

  const rate = lookupRate(table, resolution, seconds, input.hasReference);
  if (!rate) {
    const resLabel = resolution ?? input.resolution ?? "(none)";
    if (table.mode === "per_token") {
      const ref = resolveVideoRefKey(input.hasReference);
      throw new Error(
        `价目表无匹配项：resolution=${resLabel}, ref=${ref}`,
      );
    }
    if (table.mode === "per_resolution") {
      throw new Error(`价目表无匹配项：resolution=${resLabel}`);
    }
    throw new Error(`价目表无匹配项：resolution=${resLabel}, seconds=${seconds}`);
  }

  if (table.mode === "per_token") {
    const promptTokens =
      typeof input.promptTokens === "number" && Number.isFinite(input.promptTokens)
        ? Math.max(0, Math.floor(input.promptTokens))
        : 0;
    const completionTokens =
      typeof input.completionTokens === "number" &&
      Number.isFinite(input.completionTokens)
        ? Math.max(0, Math.floor(input.completionTokens))
        : typeof input.billableTokens === "number" &&
            Number.isFinite(input.billableTokens)
          ? Math.max(0, Math.floor(input.billableTokens))
          : null;
    if (completionTokens == null && promptTokens === 0) {
      throw new Error("per_token 价目表需要 token 用量");
    }
    const safeCompletion = completionTokens ?? 0;
    // Cell amounts are ¥/百万 tokens (token_1m).
    return computeTokenCharge(
      {
        currency: pricing.currency,
        customerUnit: "token_1m",
        upstreamUnit: "token_1m",
        customerAmount: rate.customer,
        upstreamAmount: rate.upstream,
        customerInputAmount: rate.customer,
        customerOutputAmount: rate.customer,
        customerImageInputAmount: null,
        upstreamInputAmount: rate.upstream,
        upstreamOutputAmount: rate.upstream,
        upstreamImageInputAmount: null,
        sizeMultipliers: null,
      },
      promptTokens,
      safeCompletion,
    );
  }

  if (table.mode === "fixed" || table.mode === "per_resolution") {
    return {
      customerCharge: rate.customer,
      upstreamCost: rate.upstream,
      currency: pricing.currency,
    };
  }

  // per_second: rate × seconds
  return computeQuantityCharge(
    {
      ...pricing,
      customerAmount: rate.customer,
      upstreamAmount: rate.upstream,
      sizeMultipliers: null,
    },
    seconds,
  );
}

/** Customer-facing price table (strips upstream). */
export function toPublicPriceTable(
  table: VideoPriceTable | null | undefined,
): {
  mode: VideoPriceTableMode;
  rates: Partial<
    Record<VideoResolution | "*", Partial<Record<string, { customer: string }>>>
  >;
} | null {
  if (!table) {
    return null;
  }
  const rates: Partial<
    Record<VideoResolution | "*", Partial<Record<string, { customer: string }>>>
  > = {};
  for (const [resKey, durationMap] of Object.entries(table.rates)) {
    if (!durationMap) {
      continue;
    }
    const publicDurations: Partial<Record<string, { customer: string }>> = {};
    for (const [durKey, rate] of Object.entries(durationMap)) {
      if (!rate) {
        continue;
      }
      publicDurations[durKey] = { customer: rate.customer };
    }
    rates[resKey as VideoResolution | "*"] = publicDurations;
  }
  return { mode: table.mode, rates };
}

/** Whether a request can be priced under the given table (or legacy). */
export function canResolveVideoCharge(
  pricing: PricingSnapshotWithTable,
  input: VideoChargeInput,
): boolean {
  try {
    // per_token needs token counts to settle; use 1M as a probe for rate lookup only.
    resolveVideoCharge(pricing, {
      ...input,
      billableTokens: input.billableTokens ?? 1_000_000,
      completionTokens:
        input.completionTokens ?? input.billableTokens ?? 1_000_000,
    });
    return true;
  } catch {
    return false;
  }
}
