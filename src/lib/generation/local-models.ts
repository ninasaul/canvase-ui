import type { PortalPublicModel } from "@/types/admin";
import {
  readByokBaseUrl,
  readByokModels,
  resolveByokConnection,
  type ByokModelPreset,
} from "@/lib/generation/byok-store";
import { listV1Models } from "@/lib/v1-client";

function presetToPortalModel(preset: ByokModelPreset): PortalPublicModel {
  return {
    id: preset.id,
    object: "model",
    created: 0,
    owned_by: preset.vendor ?? "local",
    display_name: preset.displayName?.trim() || preset.id,
    vendor: preset.vendor,
    capability: preset.capability,
  };
}

/**
 * Canvas model list is catalog-first (saved generation-config models).
 * Upstream `/v1/models` only enriches pricing / description for matching ids
 * on the active gateway — it must not invent vendors or drop other customs.
 */
export async function loadGenerationModels(): Promise<PortalPublicModel[]> {
  const catalog = readByokModels();
  if (catalog.length === 0) {
    return [];
  }

  const base = catalog.map(presetToPortalModel);

  try {
    const connection = resolveByokConnection();
    const upstream = await listV1Models("", undefined, {
      baseUrl: connection.baseUrl || readByokBaseUrl() || undefined,
      vendorId: connection.vendorId || undefined,
    });
    if (upstream.length === 0) {
      return base;
    }
    const upstreamById = new Map(
      upstream
        .map((item) => [item.id.trim(), item] as const)
        .filter(([id]) => Boolean(id)),
    );
    return base.map((model) => {
      const upstreamRow = upstreamById.get(model.id);
      if (!upstreamRow) {
        return model;
      }
      return {
        ...model,
        // Keep catalog vendor / capability / displayName as source of truth.
        description: upstreamRow.description ?? model.description,
        pricing: upstreamRow.pricing ?? model.pricing,
        created: upstreamRow.created ?? model.created,
        owned_by: model.vendor ?? upstreamRow.owned_by ?? model.owned_by,
      };
    });
  } catch {
    return base;
  }
}
