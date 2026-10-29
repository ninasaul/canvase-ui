import type { ModelVendorId } from "@/lib/tu-shared-browser";

/** Legacy single custom slot id — still valid; new ones use {@link createCustomGatewayId}. */
export const CUSTOM_VENDOR_GATEWAY_ID = "custom";

const CUSTOM_GATEWAY_ID_PATTERN = /^custom_[a-z0-9]+$/i;

export type VendorGatewayPreset = {
  /** Built-in ModelVendorId (not dynamic custom_*). */
  vendorId: ModelVendorId;
  /** Suggested Base URL (OpenAI-compatible root, no /v1). Empty = user fills in. */
  suggestedBaseUrl: string;
};

/**
 * Built-in vendor options. Custom OpenAI-compatible gateways are user-created
 * (`custom` / `custom_<id>`) and stored in profiles — no fixed cap.
 */
export const vendorGatewayPresets: VendorGatewayPreset[] = [
  {
    vendorId: "ChatGPT",
    suggestedBaseUrl: "https://api.openai.com",
  },
  {
    vendorId: "DeepSeek",
    suggestedBaseUrl: "https://api.deepseek.com",
  },
  {
    vendorId: "Qwen",
    suggestedBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode",
  },
  {
    vendorId: "Gemini",
    suggestedBaseUrl: "",
  },
  {
    vendorId: "ollama",
    suggestedBaseUrl: "http://127.0.0.1:11434",
  },
  {
    vendorId: "Grok",
    suggestedBaseUrl: "https://api.x.ai",
  },
  {
    vendorId: "Claude",
    suggestedBaseUrl: "",
  },
];

export function isCustomGatewayId(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed === CUSTOM_VENDOR_GATEWAY_ID || CUSTOM_GATEWAY_ID_PATTERN.test(trimmed)
  );
}

export function isPresetVendorGatewayId(value: string): boolean {
  return vendorGatewayPresets.some((preset) => preset.vendorId === value);
}

/** Built-in preset id, legacy `custom`, or dynamic `custom_*`. */
export function isVendorGatewayId(value: string): boolean {
  return isPresetVendorGatewayId(value) || isCustomGatewayId(value);
}

export function createCustomGatewayId(): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `custom_${suffix}`;
}

export function defaultVendorGatewayId(): string {
  return vendorGatewayPresets[0]?.vendorId ?? "ChatGPT";
}

/** @deprecated Use vendorGatewayPresets */
export const vendorModelPresets = vendorGatewayPresets;
