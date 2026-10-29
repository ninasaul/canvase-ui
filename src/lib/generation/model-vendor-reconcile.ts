import {
  CUSTOM_VENDOR_GATEWAY_ID,
  isCustomGatewayId,
  isPresetVendorGatewayId,
  isVendorGatewayId,
  vendorGatewayPresets,
} from "@/lib/generation/vendor-model-presets";
import type { ByokModelPreset } from "@/lib/generation/generation-config-types";
import { normalizeModelVendorId } from "@/lib/model-vendors";

export type ReconcileProfileHint = {
  baseUrl: string;
  secretConfigured: boolean;
};

function gatewayIdFromVendorHint(hint: string): string | null {
  const trimmed = hint.trim();
  if (!trimmed) {
    return null;
  }
  if (isVendorGatewayId(trimmed)) {
    return trimmed;
  }
  const normalized = normalizeModelVendorId(trimmed)
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, "");
  const aliases: Record<string, string> = {
    openai: "ChatGPT",
    chatgpt: "ChatGPT",
    anthropic: "Claude",
    claude: "Claude",
    google: "Gemini",
    gemini: "Gemini",
    xai: "Grok",
    grok: "Grok",
    deepseek: "DeepSeek",
    qwen: "Qwen",
    alibaba: "Qwen",
    dashscope: "Qwen",
    ollama: "ollama",
    bytedance: CUSTOM_VENDOR_GATEWAY_ID,
    custom: CUSTOM_VENDOR_GATEWAY_ID,
  };
  if (aliases[normalized]) {
    return aliases[normalized]!;
  }
  for (const preset of vendorGatewayPresets) {
    const presetKey = normalizeModelVendorId(preset.vendorId)
      .trim()
      .toLowerCase()
      .replace(/[\s._-]+/g, "");
    if (presetKey === normalized) {
      return preset.vendorId;
    }
  }
  return null;
}

function looksLikeAggregatorModelId(modelId: string): boolean {
  const id = modelId.trim();
  if (!id) {
    return false;
  }
  if (/[\u3400-\u9fff]/.test(id)) {
    return true;
  }
  return /flare|seedream|seedance|seeddance|dola|jimeng|kling|runway|midjourney|tokenmei/i.test(
    id,
  );
}

function profileReady(profile: ReconcileProfileHint | undefined): boolean {
  return Boolean(profile?.baseUrl.trim() && profile.secretConfigured);
}

/** First ready custom gateway, else null. */
function firstReadyCustomVendorId(
  profiles: Record<string, ReconcileProfileHint>,
): string | null {
  for (const [vendorId, profile] of Object.entries(profiles)) {
    if (isCustomGatewayId(vendorId) && profileReady(profile)) {
      return vendorId;
    }
  }
  return null;
}

/**
 * Prefer the active profile when ready; else the first ready custom gateway;
 * else the first ready profile.
 */
function preferredGatewayVendorId(
  activeVendorId: string,
  profiles: Record<string, ReconcileProfileHint>,
): string {
  if (profileReady(profiles[activeVendorId])) {
    return activeVendorId;
  }
  const readyCustom = firstReadyCustomVendorId(profiles);
  if (readyCustom) {
    return readyCustom;
  }
  for (const [vendorId, profile] of Object.entries(profiles)) {
    if (profileReady(profile)) {
      return vendorId;
    }
  }
  return activeVendorId;
}

/**
 * Aggregator-looking models must not be pinned to official presets (ChatGPT /
 * DeepSeek, …) just because that preset has any key. Prefer a ready custom
 * gateway (active custom first, else first ready custom).
 */
function preferredAggregatorVendorId(
  activeVendorId: string,
  profiles: Record<string, ReconcileProfileHint>,
): string {
  if (
    isCustomGatewayId(activeVendorId) &&
    profileReady(profiles[activeVendorId])
  ) {
    return activeVendorId;
  }
  const readyCustom = firstReadyCustomVendorId(profiles);
  if (readyCustom) {
    return readyCustom;
  }
  return preferredGatewayVendorId(activeVendorId, profiles);
}

/**
 * Repair model.vendor for routing. Never remaps one custom_* onto another.
 */
export function reconcileModelVendors(
  models: ByokModelPreset[],
  activeVendorId: string,
  profiles: Record<string, ReconcileProfileHint>,
): { models: ByokModelPreset[]; changed: boolean } {
  const preferred = preferredGatewayVendorId(activeVendorId, profiles);
  const aggregatorPreferred = preferredAggregatorVendorId(
    activeVendorId,
    profiles,
  );
  let changed = false;
  const next = models.map((model) => {
    const currentVendor = model.vendor?.trim() ?? "";
    let vendor = currentVendor;

    if (!vendor) {
      vendor = looksLikeAggregatorModelId(model.id)
        ? aggregatorPreferred
        : preferred;
    } else if (isCustomGatewayId(vendor)) {
      // Keep multi-custom stamps intact.
      vendor = currentVendor;
    } else if (!isVendorGatewayId(vendor)) {
      vendor = gatewayIdFromVendorHint(vendor) ?? preferred;
      if (
        isPresetVendorGatewayId(vendor) &&
        looksLikeAggregatorModelId(model.id)
      ) {
        vendor = aggregatorPreferred;
      }
    } else if (
      isPresetVendorGatewayId(vendor) &&
      looksLikeAggregatorModelId(model.id)
    ) {
      vendor = aggregatorPreferred;
    }

    if (vendor === currentVendor) {
      return model;
    }
    changed = true;
    return { ...model, vendor };
  });
  return { models: next, changed };
}
