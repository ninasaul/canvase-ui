import type { CanvasSettings } from "@/lib/tu-shared-browser";

const GENERATION_KINDS = ["image", "video", "text", "audio"] as const;

/**
 * Drop default models that are no longer present in the available model list
 * (e.g. after switching the active BYOK vendor).
 */
export function pruneCanvasSettingsModels(
  settings: CanvasSettings,
  availableModelIds: ReadonlySet<string> | readonly string[],
): { settings: CanvasSettings; changed: boolean } {
  const ids =
    availableModelIds instanceof Set
      ? availableModelIds
      : new Set(availableModelIds);
  let changed = false;
  const next: CanvasSettings = { ...settings };

  for (const kind of GENERATION_KINDS) {
    const current = settings[kind];
    const model = current?.model?.trim();
    if (!model || ids.has(model)) {
      continue;
    }
    changed = true;
    const { model: _removedModel, vendor: _removedVendor, ...rest } =
      current ?? {};
    next[kind] =
      Object.keys(rest).length > 0
        ? rest
        : undefined;
  }

  if (!changed) {
    return { settings, changed: false };
  }

  const cleaned: CanvasSettings = {};
  for (const kind of GENERATION_KINDS) {
    if (next[kind]) {
      cleaned[kind] = next[kind];
    }
  }
  return { settings: cleaned, changed: true };
}
