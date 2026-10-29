import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/storage/secret-crypto";
import {
  CUSTOM_VENDOR_GATEWAY_ID,
  defaultVendorGatewayId,
  isCustomGatewayId,
  isVendorGatewayId,
  vendorGatewayPresets,
} from "@/lib/generation/vendor-model-presets";
import { normalizeGenerationBaseUrl } from "@/lib/generation/byok-url";
import { reconcileModelVendors } from "@/lib/generation/model-vendor-reconcile";
import { normalizeModelVendorId } from "@/lib/model-vendors";
import type {
  ByokModelPreset,
  VendorGatewayProfileView,
} from "@/lib/generation/generation-config-types";

export type {
  ByokModelCapability,
  ByokModelPreset,
  VendorGatewayProfileView,
  GenerationConfigPublicView,
} from "@/lib/generation/generation-config-types";

type StoredProfile = {
  baseUrl?: string;
  apiKeyCipher?: string;
  apiKeyIv?: string;
  name?: string;
};

export type GenerationConfigWriteInput = {
  activeVendorId: string;
  profiles: Record<
    string,
    { baseUrl: string; apiKey?: string; name?: string }
  >;
  models: ByokModelPreset[];
};

function emptyProfileViews(): Record<string, VendorGatewayProfileView> {
  const profiles: Record<string, VendorGatewayProfileView> = {};
  for (const preset of vendorGatewayPresets) {
    profiles[preset.vendorId] = {
      baseUrl: preset.suggestedBaseUrl,
      secretConfigured: false,
    };
  }
  return profiles;
}

function normalizeModel(value: unknown): ByokModelPreset | null {
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

function parseStoredProfiles(
  raw: unknown,
): Record<string, StoredProfile> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, StoredProfile> = {};
  for (const [vendorId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    const row = value as StoredProfile;
    const name = typeof row.name === "string" ? row.name.trim() : undefined;
    out[vendorId] = {
      baseUrl: typeof row.baseUrl === "string" ? row.baseUrl : "",
      apiKeyCipher:
        typeof row.apiKeyCipher === "string" ? row.apiKeyCipher : undefined,
      apiKeyIv: typeof row.apiKeyIv === "string" ? row.apiKeyIv : undefined,
      ...(name ? { name } : {}),
    };
  }
  return out;
}

function toPublicView(input: {
  activeVendorId: string;
  profiles: Record<string, StoredProfile>;
  models: ByokModelPreset[];
}): import("@/lib/generation/generation-config-types").GenerationConfigPublicView {
  const profiles = emptyProfileViews();
  for (const [vendorId, stored] of Object.entries(input.profiles)) {
    const name = stored.name?.trim();
    profiles[vendorId] = {
      baseUrl: (stored.baseUrl ?? "").trim().replace(/\/$/, ""),
      secretConfigured: Boolean(
        stored.apiKeyCipher?.trim() && stored.apiKeyIv?.trim(),
      ),
      ...(isCustomGatewayId(vendorId)
        ? { name: name || (vendorId === CUSTOM_VENDOR_GATEWAY_ID ? "Custom" : vendorId) }
        : name
          ? { name }
          : {}),
    };
  }
  const activeVendorId =
    input.activeVendorId in profiles
      ? input.activeVendorId
      : defaultVendorGatewayId();
  const active = profiles[activeVendorId] ?? {
    baseUrl: "",
    secretConfigured: false,
  };
  return {
    configured: input.models.length > 0,
    activeVendorId,
    baseUrl: active.baseUrl,
    profiles,
    models: input.models,
  };
}

export async function getGenerationConfigPublicView(
  userId: string,
): Promise<
  import("@/lib/generation/generation-config-types").GenerationConfigPublicView
> {
  const row = await prisma.userGenerationConfig.findUnique({
    where: { userId },
  });
  if (!row) {
    const activeVendorId = defaultVendorGatewayId();
    return {
      configured: false,
      activeVendorId,
      baseUrl: emptyProfileViews()[activeVendorId]?.baseUrl ?? "",
      profiles: emptyProfileViews(),
      models: [],
    };
  }
  const profiles = parseStoredProfiles(row.profilesJson);
  const parsedModels = Array.isArray(row.modelsJson)
    ? row.modelsJson
        .map(normalizeModel)
        .filter((item): item is ByokModelPreset => item !== null)
    : [];
  const profileHints: Record<
    string,
    { baseUrl: string; secretConfigured: boolean }
  > = {};
  for (const [vendorId, stored] of Object.entries(profiles)) {
    profileHints[vendorId] = {
      baseUrl: (stored.baseUrl ?? "").trim(),
      secretConfigured: Boolean(
        stored.apiKeyCipher?.trim() && stored.apiKeyIv?.trim(),
      ),
    };
  }
  for (const preset of vendorGatewayPresets) {
    if (!(preset.vendorId in profileHints)) {
      profileHints[preset.vendorId] = {
        baseUrl: preset.suggestedBaseUrl,
        secretConfigured: false,
      };
    }
  }
  const reconciled = reconcileModelVendors(
    parsedModels,
    row.activeVendorId,
    profileHints,
  );
  if (reconciled.changed) {
    await prisma.userGenerationConfig.update({
      where: { userId },
      data: { modelsJson: reconciled.models },
    });
  }
  return toPublicView({
    activeVendorId: row.activeVendorId,
    profiles,
    models: reconciled.models,
  });
}

export async function upsertGenerationConfig(
  userId: string,
  input: GenerationConfigWriteInput,
): Promise<
  import("@/lib/generation/generation-config-types").GenerationConfigPublicView
> {
  const existing = await prisma.userGenerationConfig.findUnique({
    where: { userId },
  });
  const existingProfiles = existing
    ? parseStoredProfiles(existing.profilesJson)
    : {};

  const nextProfiles: Record<string, StoredProfile> = {};
  for (const [vendorId, profile] of Object.entries(input.profiles)) {
    const baseUrl = profile.baseUrl.trim()
      ? normalizeGenerationBaseUrl(profile.baseUrl)
      : "";
    const secretInput = profile.apiKey?.trim() ?? "";
    const previous = existingProfiles[vendorId];
    const name = profile.name?.trim() || previous?.name?.trim() || undefined;
    const nameFields =
      isCustomGatewayId(vendorId) || name
        ? {
            name:
              name ||
              (vendorId === CUSTOM_VENDOR_GATEWAY_ID ? "Custom" : vendorId),
          }
        : {};
    if (secretInput) {
      const encrypted = encryptSecret(secretInput);
      nextProfiles[vendorId] = {
        baseUrl,
        apiKeyCipher: encrypted.cipher,
        apiKeyIv: encrypted.iv,
        ...nameFields,
      };
      continue;
    }
    nextProfiles[vendorId] = {
      baseUrl,
      apiKeyCipher: previous?.apiKeyCipher,
      apiKeyIv: previous?.apiKeyIv,
      ...nameFields,
    };
  }

  // Input profiles are authoritative (supports deleting custom gateways).
  // Ensure built-in presets always exist so the UI can select them.
  for (const preset of vendorGatewayPresets) {
    if (preset.vendorId in nextProfiles) {
      continue;
    }
    const previous = existingProfiles[preset.vendorId];
    nextProfiles[preset.vendorId] = previous ?? {
      baseUrl: preset.suggestedBaseUrl,
    };
  }

  const activeVendorId =
    input.activeVendorId in nextProfiles ||
    isVendorGatewayId(input.activeVendorId)
      ? input.activeVendorId
      : defaultVendorGatewayId();

  const parsedModels = input.models
    .map((item) => normalizeModel(item))
    .filter((item): item is ByokModelPreset => item !== null);

  const profileHints: Record<
    string,
    { baseUrl: string; secretConfigured: boolean }
  > = {};
  for (const [vendorId, stored] of Object.entries(nextProfiles)) {
    profileHints[vendorId] = {
      baseUrl: (stored.baseUrl ?? "").trim(),
      secretConfigured: Boolean(
        stored.apiKeyCipher?.trim() && stored.apiKeyIv?.trim(),
      ),
    };
  }
  const models = reconcileModelVendors(
    parsedModels,
    activeVendorId,
    profileHints,
  ).models;

  await prisma.userGenerationConfig.upsert({
    where: { userId },
    create: {
      userId,
      activeVendorId,
      profilesJson: nextProfiles,
      modelsJson: models,
    },
    update: {
      activeVendorId,
      profilesJson: nextProfiles,
      modelsJson: models,
    },
  });

  return toPublicView({
    activeVendorId,
    profiles: nextProfiles,
    models,
  });
}

export async function deleteGenerationConfig(userId: string): Promise<void> {
  await prisma.userGenerationConfig.deleteMany({ where: { userId } });
}

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

function decryptProfileKey(profile: StoredProfile | undefined): string {
  if (!profile?.apiKeyCipher?.trim() || !profile.apiKeyIv?.trim()) {
    return "";
  }
  try {
    return decryptSecret(profile.apiKeyCipher, profile.apiKeyIv).trim();
  } catch {
    return "";
  }
}

/**
 * Resolve a decrypted upstream API key for the authenticated user.
 * Prefers vendorId, then matching baseUrl, then active profile.
 */
export async function resolveUserGenerationApiKey(
  userId: string,
  hints?: { vendorId?: string | null; baseUrl?: string | null },
): Promise<string> {
  const row = await prisma.userGenerationConfig.findUnique({
    where: { userId },
  });
  if (!row) {
    return "";
  }
  const profiles = parseStoredProfiles(row.profilesJson);
  const candidates: string[] = [];
  if (hints?.vendorId?.trim()) {
    candidates.push(hints.vendorId.trim());
    const mapped = gatewayIdFromVendorHint(hints.vendorId);
    if (mapped) {
      candidates.push(mapped);
    }
  }
  candidates.push(row.activeVendorId);

  for (const candidate of candidates) {
    const key = decryptProfileKey(profiles[candidate]);
    if (key) {
      return key;
    }
  }

  const wantedBase = (hints?.baseUrl ?? "").trim().replace(/\/$/, "");
  if (wantedBase) {
    for (const profile of Object.values(profiles)) {
      const base = (profile.baseUrl ?? "").trim().replace(/\/$/, "");
      if (base && base === wantedBase) {
        const key = decryptProfileKey(profile);
        if (key) {
          return key;
        }
      }
    }
  }

  return "";
}
