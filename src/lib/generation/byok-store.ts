/**
 * Generation provider config: models / base URLs cached in the browser;
 * API keys are encrypted server-side (never stored plaintext locally).
 */

import { getAdminApiBaseUrl } from "@/lib/api";
import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage,
} from "@/lib/playground-browser-storage";
import { normalizeGenerationBaseUrl } from "@/lib/generation/byok-url";
import type {
  ByokModelCapability,
  ByokModelPreset,
  GenerationConfigPublicView,
  VendorGatewayProfileView,
} from "@/lib/generation/generation-config-types";
import {
  CUSTOM_VENDOR_GATEWAY_ID,
  defaultVendorGatewayId,
  isCustomGatewayId,
  isVendorGatewayId,
  vendorGatewayPresets,
} from "@/lib/generation/vendor-model-presets";
import { normalizeModelVendorId } from "@/lib/model-vendors";

export { normalizeGenerationBaseUrl } from "@/lib/generation/byok-url";
export {
  BYOK_API_KEY_HEADER,
  BYOK_BASE_HEADER,
  BYOK_VENDOR_HEADER,
  GENERATION_API_KEY_HEADER,
  GENERATION_BASE_HEADER,
  GENERATION_VENDOR_HEADER,
} from "@/lib/generation/byok-url";
export type {
  ByokModelCapability,
  ByokModelPreset,
  GenerationConfigPublicView,
  VendorGatewayProfileView,
} from "@/lib/generation/generation-config-types";

const CONFIG_STORAGE = "canvase.byok.config";
const LEGACY_MIGRATED_FLAG = "canvase.byok.migrated-to-server";

/** Draft profile used by the settings UI (apiKey is write-only). */
export type VendorGatewayProfile = {
  baseUrl: string;
  apiKey: string;
  secretConfigured?: boolean;
  /** Display name for custom gateways. */
  name?: string;
};

export type GenerationProviderConfig = {
  baseUrl: string;
  /** Always empty on the client — keys stay on the server. */
  apiKey: string;
  activeVendorId: string;
  profiles: Record<string, VendorGatewayProfile>;
  models: ByokModelPreset[];
  configured?: boolean;
};

/** @deprecated Use GenerationProviderConfig */
export type ByokConfig = GenerationProviderConfig;

type CachedGenerationConfig = {
  activeVendorId?: string;
  profiles?: Record<
    string,
    { baseUrl?: string; secretConfigured?: boolean; name?: string; apiKey?: string }
  >;
  models?: unknown[];
  /** Legacy plaintext fields — migrated once then stripped. */
  baseUrl?: string;
  apiKey?: string;
};

function emptyProfiles(): Record<string, VendorGatewayProfile> {
  const profiles: Record<string, VendorGatewayProfile> = {};
  for (const preset of vendorGatewayPresets) {
    profiles[preset.vendorId] = {
      baseUrl: preset.suggestedBaseUrl,
      apiKey: "",
      secretConfigured: false,
    };
  }
  return profiles;
}

function profileFromView(
  vendorId: string,
  profile: VendorGatewayProfileView,
): VendorGatewayProfile {
  return {
    baseUrl: profile.baseUrl,
    apiKey: "",
    secretConfigured: profile.secretConfigured,
    ...(isCustomGatewayId(vendorId) || profile.name
      ? {
          name:
            profile.name?.trim() ||
            (vendorId === CUSTOM_VENDOR_GATEWAY_ID ? "Custom" : vendorId),
        }
      : {}),
  };
}

function normalizeStoredModel(value: unknown): ByokModelPreset | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Partial<ByokModelPreset>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const capability = row.capability;
  if (
    !id ||
    (capability !== "image" && capability !== "video" && capability !== "chat")
  ) {
    return null;
  }
  const displayName =
    typeof row.displayName === "string" ? row.displayName.trim() : undefined;
  const vendor = typeof row.vendor === "string" ? row.vendor.trim() : undefined;
  return {
    id,
    capability,
    ...(displayName ? { displayName } : {}),
    ...(vendor ? { vendor } : {}),
  };
}

function viewToProviderConfig(
  view: GenerationConfigPublicView,
): GenerationProviderConfig {
  const profiles = emptyProfiles();
  for (const [vendorId, profile] of Object.entries(view.profiles)) {
    profiles[vendorId] = profileFromView(vendorId, profile);
  }
  const active =
    profiles[view.activeVendorId] ??
    profiles[defaultVendorGatewayId()] ?? {
      baseUrl: "",
      apiKey: "",
      secretConfigured: false,
    };
  return {
    baseUrl: active.baseUrl,
    apiKey: "",
    activeVendorId: view.activeVendorId,
    profiles,
    models: view.models,
    configured: view.configured,
  };
}

function readCachedConfig(): GenerationProviderConfig {
  const defaults = emptyProfiles();
  const defaultVendorId = defaultVendorGatewayId();
  try {
    const raw = readBrowserStorage(CONFIG_STORAGE);
    if (!raw) {
      return {
        baseUrl: defaults[defaultVendorId]?.baseUrl ?? "",
        apiKey: "",
        activeVendorId: defaultVendorId,
        profiles: defaults,
        models: [],
        configured: false,
      };
    }
    const parsed = JSON.parse(raw) as CachedGenerationConfig;
    const profiles = emptyProfiles();
    if (parsed.profiles && typeof parsed.profiles === "object") {
      for (const [vendorId, value] of Object.entries(parsed.profiles)) {
        if (!value || typeof value !== "object") {
          continue;
        }
        const row = value as {
          baseUrl?: string;
          apiKey?: string;
          secretConfigured?: boolean;
        };
        const name =
          typeof (row as { name?: string }).name === "string"
            ? (row as { name?: string }).name!.trim()
            : undefined;
        profiles[vendorId] = {
          baseUrl:
            typeof row.baseUrl === "string"
              ? row.baseUrl.trim()
              : profiles[vendorId]?.baseUrl ?? "",
          apiKey: "",
          secretConfigured: Boolean(row.secretConfigured) || Boolean(row.apiKey),
          ...(name || isCustomGatewayId(vendorId)
            ? {
                name:
                  name ||
                  (vendorId === CUSTOM_VENDOR_GATEWAY_ID ? "Custom" : vendorId),
              }
            : {}),
        };
      }
    }
    const legacyBaseUrl =
      typeof parsed.baseUrl === "string" ? parsed.baseUrl.trim() : "";
    const legacyApiKey =
      typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : "";
    if (legacyBaseUrl || legacyApiKey) {
      const current = profiles[defaultVendorId] ?? {
        baseUrl: "",
        apiKey: "",
        secretConfigured: false,
      };
      profiles[defaultVendorId] = {
        baseUrl: current.baseUrl || legacyBaseUrl,
        apiKey: "",
        secretConfigured: current.secretConfigured || Boolean(legacyApiKey),
      };
    }
    const activeVendorId =
      typeof parsed.activeVendorId === "string" &&
      parsed.activeVendorId in profiles
        ? parsed.activeVendorId
        : defaultVendorId;
    const active = profiles[activeVendorId] ?? {
      baseUrl: "",
      apiKey: "",
      secretConfigured: false,
    };
    const models = Array.isArray(parsed.models)
      ? parsed.models
          .map(normalizeStoredModel)
          .filter((item): item is ByokModelPreset => item !== null)
      : [];
    return {
      baseUrl: active.baseUrl,
      apiKey: "",
      activeVendorId,
      profiles,
      models,
      configured: models.length > 0,
    };
  } catch {
    return {
      baseUrl: defaults[defaultVendorId]?.baseUrl ?? "",
      apiKey: "",
      activeVendorId: defaultVendorId,
      profiles: defaults,
      models: [],
      configured: false,
    };
  }
}

function writeCachedConfig(config: GenerationProviderConfig): void {
  const profiles: Record<
    string,
    { baseUrl: string; secretConfigured: boolean; name?: string }
  > = {};
  for (const [vendorId, profile] of Object.entries(config.profiles)) {
    profiles[vendorId] = {
      baseUrl: profile.baseUrl.trim().replace(/\/$/, ""),
      secretConfigured: Boolean(profile.secretConfigured),
      ...(profile.name?.trim() ? { name: profile.name.trim() } : {}),
    };
  }
  writeBrowserStorage(
    CONFIG_STORAGE,
    JSON.stringify({
      activeVendorId: config.activeVendorId,
      profiles,
      models: config.models,
    }),
  );
}

function readLegacyPlaintextForMigration(): {
  activeVendorId: string;
  profiles: Record<string, { baseUrl: string; apiKey: string }>;
  models: ByokModelPreset[];
} | null {
  if (readBrowserStorage(LEGACY_MIGRATED_FLAG) === "1") {
    return null;
  }
  try {
    const raw = readBrowserStorage(CONFIG_STORAGE);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CachedGenerationConfig;
    const profiles: Record<string, { baseUrl: string; apiKey: string }> = {};
    let hasPlaintextKey = false;
    if (parsed.profiles && typeof parsed.profiles === "object") {
      for (const [vendorId, value] of Object.entries(parsed.profiles)) {
        if (!value || typeof value !== "object") {
          continue;
        }
        const row = value as { baseUrl?: string; apiKey?: string };
        const apiKey = typeof row.apiKey === "string" ? row.apiKey.trim() : "";
        if (apiKey) {
          hasPlaintextKey = true;
        }
        profiles[vendorId] = {
          baseUrl: typeof row.baseUrl === "string" ? row.baseUrl.trim() : "",
          apiKey,
        };
      }
    }
    const legacyApiKey =
      typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : "";
    const legacyBaseUrl =
      typeof parsed.baseUrl === "string" ? parsed.baseUrl.trim() : "";
    if (legacyApiKey || legacyBaseUrl) {
      const defaultVendorId = defaultVendorGatewayId();
      const current = profiles[defaultVendorId] ?? { baseUrl: "", apiKey: "" };
      profiles[defaultVendorId] = {
        baseUrl: current.baseUrl || legacyBaseUrl,
        apiKey: current.apiKey || legacyApiKey,
      };
      if (legacyApiKey) {
        hasPlaintextKey = true;
      }
    }
    if (!hasPlaintextKey) {
      return null;
    }
    const models = Array.isArray(parsed.models)
      ? parsed.models
          .map(normalizeStoredModel)
          .filter((item): item is ByokModelPreset => item !== null)
      : [];
    const activeVendorId =
      typeof parsed.activeVendorId === "string" &&
      parsed.activeVendorId in profiles
        ? parsed.activeVendorId
        : defaultVendorGatewayId();
    return { activeVendorId, profiles, models };
  } catch {
    return null;
  }
}

async function parseConfigResponse(
  response: Response,
): Promise<GenerationConfigPublicView> {
  const payload = (await response.json().catch(() => null)) as
    | (GenerationConfigPublicView & { error?: string; message?: string })
    | null;
  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      `Generation config request failed (${response.status})`;
    throw new Error(typeof message === "string" ? message : "Request failed");
  }
  if (!payload) {
    throw new Error("Invalid generation config response");
  }
  return {
    configured: Boolean(payload.configured),
    activeVendorId: payload.activeVendorId || defaultVendorGatewayId(),
    baseUrl: payload.baseUrl ?? "",
    profiles: payload.profiles ?? {},
    models: Array.isArray(payload.models)
      ? payload.models
          .map(normalizeStoredModel)
          .filter((item): item is ByokModelPreset => item !== null)
      : [],
  };
}

export function readByokBaseUrl(): string {
  return readCachedConfig().baseUrl.trim().replace(/\/$/, "");
}

export function readGenerationBaseUrl(): string {
  return readByokBaseUrl();
}

/** Client never holds plaintext keys; proxy injects from encrypted DB. */
export function readByokApiKey(): string {
  return "";
}

export function readGenerationApiKey(): string {
  return readByokApiKey();
}

export type ByokConnection = {
  vendorId: string;
  baseUrl: string;
  /** Always empty on client after server migration. */
  apiKey: string;
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

/**
 * Resolve which vendor profile to use for a generation request.
 * Prefers the model catalog vendor (source of truth), then node vendor,
 * then the active profile. API key is resolved server-side from encrypted storage.
 */
export function resolveByokConnection(hints?: {
  vendor?: string | null;
  modelId?: string | null;
}): ByokConnection {
  const config = readCachedConfig();
  const candidates: string[] = [];
  if (hints?.modelId?.trim()) {
    const preset = config.models.find(
      (model) => model.id === hints.modelId?.trim(),
    );
    if (preset?.vendor?.trim()) {
      candidates.push(preset.vendor.trim());
    }
  }
  if (hints?.vendor?.trim()) {
    candidates.push(hints.vendor.trim());
  }

  for (const candidate of candidates) {
    if (candidate in config.profiles) {
      const profile = config.profiles[candidate]!;
      return {
        vendorId: candidate,
        baseUrl: profile.baseUrl.trim().replace(/\/$/, ""),
        apiKey: "",
      };
    }
    const gatewayId = gatewayIdFromVendorHint(candidate);
    if (gatewayId && gatewayId in config.profiles) {
      const profile = config.profiles[gatewayId]!;
      return {
        vendorId: gatewayId,
        baseUrl: profile.baseUrl.trim().replace(/\/$/, ""),
        apiKey: "",
      };
    }
  }

  const active = config.profiles[config.activeVendorId] ?? {
    baseUrl: config.baseUrl,
    apiKey: "",
  };
  return {
    vendorId: config.activeVendorId,
    baseUrl: active.baseUrl.trim().replace(/\/$/, ""),
    apiKey: "",
  };
}

export function readByokModels(): ByokModelPreset[] {
  return readCachedConfig().models;
}

export function readCachedActiveVendorId(): string {
  return readCachedConfig().activeVendorId;
}

export function readGenerationModels(): ByokModelPreset[] {
  return readByokModels();
}

export function isGenerationConfigured(): boolean {
  return readByokModels().length > 0;
}

export async function readByokConfig(): Promise<GenerationProviderConfig> {
  const response = await fetch(
    `${getAdminApiBaseUrl()}/api/generation-config`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  if (response.status === 401) {
    return readCachedConfig();
  }

  const view = await parseConfigResponse(response);

  // One-time migrate legacy plaintext localStorage keys into encrypted DB.
  if (!view.configured) {
    const legacy = readLegacyPlaintextForMigration();
    if (legacy && (legacy.models.length > 0 || Object.values(legacy.profiles).some((item) => item.apiKey || item.baseUrl))) {
      try {
        const migrated = await writeByokConfig({
          activeVendorId: legacy.activeVendorId,
          profiles: legacy.profiles,
          models: legacy.models,
        });
        writeBrowserStorage(LEGACY_MIGRATED_FLAG, "1");
        return migrated;
      } catch {
        // Keep local cache if migration fails (e.g. offline).
      }
    }
  } else {
    writeBrowserStorage(LEGACY_MIGRATED_FLAG, "1");
  }

  const config = viewToProviderConfig(view);
  writeCachedConfig(config);
  return config;
}

export async function readGenerationConfig(): Promise<GenerationProviderConfig> {
  return readByokConfig();
}

export async function writeByokConfig(input: {
  activeVendorId: string;
  profiles: Record<string, VendorGatewayProfile>;
  models: ByokModelPreset[];
}): Promise<GenerationProviderConfig> {
  const profiles: Record<
    string,
    { baseUrl: string; apiKey?: string; name?: string }
  > = {};
  for (const [vendorId, profile] of Object.entries(input.profiles)) {
    profiles[vendorId] = {
      baseUrl: profile.baseUrl.trim()
        ? normalizeGenerationBaseUrl(profile.baseUrl)
        : "",
      ...(profile.apiKey.trim() ? { apiKey: profile.apiKey.trim() } : {}),
      ...(profile.name?.trim() || isCustomGatewayId(vendorId)
        ? {
            name:
              profile.name?.trim() ||
              (vendorId === CUSTOM_VENDOR_GATEWAY_ID ? "Custom" : vendorId),
          }
        : {}),
    };
  }

  const response = await fetch(
    `${getAdminApiBaseUrl()}/api/generation-config`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activeVendorId: input.activeVendorId,
        profiles,
        models: input.models,
      }),
    },
  );
  const view = await parseConfigResponse(response);
  const config = viewToProviderConfig(view);
  writeCachedConfig(config);
  writeBrowserStorage(LEGACY_MIGRATED_FLAG, "1");
  return config;
}

export async function writeGenerationConfig(input: {
  activeVendorId: string;
  profiles: Record<string, VendorGatewayProfile>;
  models: ByokModelPreset[];
}): Promise<GenerationProviderConfig> {
  return writeByokConfig(input);
}

export function clearByokConfig(): void {
  removeBrowserStorage(CONFIG_STORAGE);
  removeBrowserStorage(LEGACY_MIGRATED_FLAG);
}

export function withNormalizedBaseUrl(baseUrl: string): string {
  return normalizeGenerationBaseUrl(baseUrl);
}

/**
 * Merge incoming models. New ids are appended; existing ids refresh
 * vendor / displayName from the pull so gateway stamping can repair routing.
 */
export function mergeByokModels(
  current: ByokModelPreset[],
  incoming: ByokModelPreset[],
): { models: ByokModelPreset[]; addedCount: number } {
  const models = [...current];
  const indexById = new Map(
    models.map((item, index) => [item.id.trim(), index] as const),
  );
  let addedCount = 0;
  for (const item of incoming) {
    const id = item.id.trim();
    if (!id) {
      continue;
    }
    const vendor = item.vendor?.trim();
    const displayName = item.displayName?.trim();
    const existingIndex = indexById.get(id);
    if (existingIndex !== undefined) {
      const currentRow = models[existingIndex]!;
      models[existingIndex] = {
        ...currentRow,
        ...(displayName ? { displayName } : {}),
        ...(vendor ? { vendor } : {}),
      };
      continue;
    }
    indexById.set(id, models.length);
    models.push({
      id,
      capability: item.capability,
      ...(displayName ? { displayName } : {}),
      ...(vendor ? { vendor } : {}),
    });
    addedCount += 1;
  }
  return { models, addedCount };
}

export function formatByokModelsText(models: ByokModelPreset[]): string {
  return models
    .map((model) => `${model.capability}:${model.id}`)
    .join("\n");
}

export function parseByokModelsText(value: string): ByokModelPreset[] {
  const models: ByokModelPreset[] = [];
  for (const line of value.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const [capabilityRaw, idRaw] = trimmed.includes(":")
      ? trimmed.split(":", 2)
      : ["image", trimmed];
    const capability = capabilityRaw.trim();
    const id = (idRaw ?? "").trim();
    if (!id) {
      continue;
    }
    if (
      capability !== "image" &&
      capability !== "video" &&
      capability !== "chat"
    ) {
      continue;
    }
    models.push({ id, capability });
  }
  return models;
}
