"use client";

import { ArrowClockwise, Plus, Trash } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";

import { ModelNameWithLogo } from "@/components/model-name-with-logo";
import {
  CompactFields,
  FormField,
  SelectField,
} from "@/components/form-field";
import {
  PreferenceControl,
  PreferenceGroup,
  PreferenceRow,
} from "@/components/preference-list";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { selectTriggerClassName } from "@/components/ui/form-control";
import { Icon } from "@/components/ui/icon";
import { Loading } from "@/components/ui/loading";
import { Modal } from "@/components/ui/modal";
import { Select, type SelectOption } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { useMessages } from "@/hooks/use-feature-messages";
import {
  mergeByokModels,
  normalizeGenerationBaseUrl,
  readByokConfig,
  writeByokConfig,
  type ByokModelCapability,
  type ByokModelPreset,
  type VendorGatewayProfile,
} from "@/lib/generation/byok-store";

import {
  CUSTOM_VENDOR_GATEWAY_ID,
  createCustomGatewayId,
  defaultVendorGatewayId,
  isCustomGatewayId,
  isPresetVendorGatewayId,
  isVendorGatewayId,
  vendorGatewayPresets,
} from "@/lib/generation/vendor-model-presets";
import { modelVendorLabel, modelVendors } from "@/lib/model-vendors";
import { listV1Models, V1RequestError } from "@/lib/v1-client";


const CAPABILITIES: ByokModelCapability[] = ["image", "video", "chat"];

type DraftRow = ByokModelPreset & { key: string };

function createRow(seed?: Partial<ByokModelPreset>): DraftRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    id: seed?.id ?? "",
    capability: seed?.capability ?? "chat",
    displayName: seed?.displayName ?? "",
    vendor: seed?.vendor ?? "",
  };
}

function emptyProfilesDraft(): Record<string, VendorGatewayProfile> {
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

function normalizeCapability(value: unknown): ByokModelCapability {
  if (value === "image" || value === "video" || value === "chat") {
    return value;
  }
  if (value === "text") {
    return "chat";
  }
  return "chat";
}

function mapGatewayModels(
  items: Awaited<ReturnType<typeof listV1Models>>,
  vendorHint?: string,
): ByokModelPreset[] {
  return items.map((item) => {
    // Always stamp the gateway profile used for this pull — never upstream
    // owned_by / logo inference — so encrypted apiKey routing stays correct.
    const vendor = vendorHint?.trim() || "";
    return {
      id: item.id,
      capability: normalizeCapability(item.capability),
      displayName: item.display_name?.trim() || item.id,
      ...(vendor ? { vendor } : {}),
    };
  });
}

const EMPTY_VENDOR_VALUE = "__none__";

function vendorSelectLeading(vendorId: string, label: string) {
  if (
    !vendorId.trim() ||
    vendorId === EMPTY_VENDOR_VALUE ||
    isCustomGatewayId(vendorId)
  ) {
    return undefined;
  }
  return (
    <ModelNameWithLogo
      name={label}
      matchParts={[vendorId]}
      size={14}
      layout="inline"
      nameClassName="sr-only"
      className="pointer-events-none"
    />
  );
}

type CanvasModelSettingsModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function CanvasModelSettingsModal({
  open,
  onClose,
  onSaved,
}: CanvasModelSettingsModalProps) {
  const messages = useMessages();
  const canvas = messages.canvas;
  const defaultVendorId = defaultVendorGatewayId();
  const [activeVendorId, setActiveVendorId] = useState(defaultVendorId);
  const [profiles, setProfiles] =
    useState<Record<string, VendorGatewayProfile>>(emptyProfilesDraft);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pulling, setPulling] = useState(false);

  const activeProfile = profiles[activeVendorId] ?? {
    baseUrl: "",
    apiKey: "",
    secretConfigured: false,
  };
  const activeIsCustom = isCustomGatewayId(activeVendorId);

  function vendorLabel(vendorId: string): string {
    if (isCustomGatewayId(vendorId)) {
      const named = profiles[vendorId]?.name?.trim();
      if (named) {
        return named;
      }
      return vendorId === CUSTOM_VENDOR_GATEWAY_ID
        ? canvas.byokVendorCustom
        : vendorId;
    }
    return modelVendorLabel(vendorId);
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    setLoading(true);
    void (async () => {
      try {
        const config = await readByokConfig();
        const nextProfiles = {
          ...emptyProfilesDraft(),
          ...config.profiles,
        };
        const nextVendorId = isVendorGatewayId(config.activeVendorId)
          ? config.activeVendorId
          : defaultVendorId;
        setProfiles(nextProfiles);
        setActiveVendorId(
          nextVendorId in nextProfiles ? nextVendorId : defaultVendorId,
        );
        setRows(config.models.map((model) => createRow(model)));
      } catch {
        setActiveVendorId(defaultVendorId);
        setProfiles(emptyProfilesDraft());
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [defaultVendorId, open]);

  function updateActiveProfile(patch: Partial<VendorGatewayProfile>) {
    setProfiles((current) => ({
      ...current,
      [activeVendorId]: {
        ...(current[activeVendorId] ?? {
          baseUrl: "",
          apiKey: "",
          secretConfigured: false,
        }),
        ...patch,
      },
    }));
  }

  const vendorOptions: SelectOption[] = useMemo(() => {
    const presetOptions = vendorGatewayPresets.map((preset) => {
      const label = modelVendorLabel(preset.vendorId);
      return {
        value: preset.vendorId,
        label,
        leading: vendorSelectLeading(preset.vendorId, label),
      };
    });
    const customOptions = Object.keys(profiles)
      .filter((vendorId) => isCustomGatewayId(vendorId))
      .sort((left, right) => vendorLabel(left).localeCompare(vendorLabel(right)))
      .map((vendorId) => ({
        value: vendorId,
        label: vendorLabel(vendorId),
      }));
    return [...presetOptions, ...customOptions];
  }, [canvas.byokVendorCustom, profiles, activeVendorId]);

  /** Per-model vendor dropdown: logo + name for known vendors / gateways. */
  const modelVendorOptions: SelectOption[] = useMemo(() => {
    const none: SelectOption = {
      value: EMPTY_VENDOR_VALUE,
      label: canvas.byokVendorNone,
    };
    const presetOptions = vendorGatewayPresets.map((preset) => {
      const label = modelVendorLabel(preset.vendorId);
      return {
        value: preset.vendorId,
        label,
        leading: vendorSelectLeading(preset.vendorId, label),
      };
    });
    const customOptions = Object.keys(profiles)
      .filter((vendorId) => isCustomGatewayId(vendorId))
      .sort((left, right) => vendorLabel(left).localeCompare(vendorLabel(right)))
      .map((vendorId) => {
        const label = vendorLabel(vendorId);
        return {
          value: vendorId,
          label,
        };
      });
    const logoVendors = modelVendors
      .filter((vendor) => !isVendorGatewayId(vendor.id))
      .map((vendor) => ({
        value: vendor.id,
        label: vendor.label,
        leading: vendorSelectLeading(vendor.id, vendor.label),
      }));
    return [none, ...presetOptions, ...customOptions, ...logoVendors];
  }, [canvas.byokVendorCustom, canvas.byokVendorNone, profiles]);

  function handleSelectVendor(vendorId: string) {
    if (!(vendorId in profiles) && !isPresetVendorGatewayId(vendorId)) {
      return;
    }
    setActiveVendorId(vendorId);
    setError(null);
    if (!isPresetVendorGatewayId(vendorId)) {
      return;
    }
    const preset = vendorGatewayPresets.find(
      (item) => item.vendorId === vendorId,
    );
    if (!preset) {
      return;
    }
    setProfiles((current) => {
      const existing = current[preset.vendorId];
      if (existing?.baseUrl.trim() || !preset.suggestedBaseUrl.trim()) {
        return {
          ...current,
          [preset.vendorId]: existing ?? {
            baseUrl: "",
            apiKey: "",
            secretConfigured: false,
          },
        };
      }
      return {
        ...current,
        [preset.vendorId]: {
          baseUrl: preset.suggestedBaseUrl.trim(),
          apiKey: existing?.apiKey ?? "",
          secretConfigured: existing?.secretConfigured ?? false,
        },
      };
    });
  }

  function handleAddCustomGateway() {
    const gatewayId = createCustomGatewayId();
    const defaultName = `${canvas.byokVendorCustom} ${
      Object.keys(profiles).filter((id) => isCustomGatewayId(id)).length + 1
    }`;
    setProfiles((current) => ({
      ...current,
      [gatewayId]: {
        baseUrl: "",
        apiKey: "",
        secretConfigured: false,
        name: defaultName,
      },
    }));
    setActiveVendorId(gatewayId);
    setError(null);
  }

  function handleRemoveCustomGateway() {
    if (!isCustomGatewayId(activeVendorId)) {
      return;
    }
    if (!window.confirm(canvas.byokVendorRemoveCustomConfirm)) {
      return;
    }
    const removedId = activeVendorId;
    setProfiles((current) => {
      const next = { ...current };
      delete next[removedId];
      return next;
    });
    setRows((current) =>
      current.map((row) =>
        row.vendor === removedId ? { ...row, vendor: "" } : row,
      ),
    );
    setActiveVendorId(defaultVendorId);
    setError(null);
  }

  async function pullModels() {
    const normalized = normalizeGenerationBaseUrl(activeProfile.baseUrl);
    if (!normalized) {
      setError(canvas.byokPullNeedBaseUrl);
      return;
    }
    if (!activeProfile.apiKey.trim() && !activeProfile.secretConfigured) {
      setError(canvas.byokApiKeyRequired);
      return;
    }

    setPulling(true);
    setError(null);
    try {
      const upstream = await listV1Models("", undefined, {
        baseUrl: normalized,
        apiKey: activeProfile.apiKey.trim() || undefined,
        vendorId: activeVendorId,
      });
      if (upstream.length === 0) {
        setError(canvas.byokPullEmpty);
        return;
      }
      const incoming = mapGatewayModels(upstream, activeVendorId);
      const current: ByokModelPreset[] = rows
        .map((row) => ({
          id: row.id.trim(),
          capability: row.capability,
          displayName: row.displayName?.trim() || undefined,
          vendor: row.vendor?.trim() || undefined,
        }))
        .filter((row) => row.id);
      const { models, addedCount } = mergeByokModels(current, incoming);
      setRows(models.map((model) => createRow(model)));
      if (addedCount > 0) {
        toast.success(
          canvas.byokVendorPresetApplied.replace(
            "{count}",
            String(addedCount),
          ),
        );
      } else {
        toast.info(canvas.byokVendorPresetNone);
      }
    } catch (caught) {
      const message =
        caught instanceof V1RequestError || caught instanceof Error
          ? caught.message
          : canvas.byokPullFailed;
      setError(message || canvas.byokPullFailed);
    } finally {
      setPulling(false);
    }
  }

  function updateRow(key: string, patch: Partial<ByokModelPreset>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  async function handleSave() {
    const nextProfiles: Record<string, VendorGatewayProfile> = {};
    for (const [vendorId, profile] of Object.entries(profiles)) {
      if (profile.baseUrl.trim()) {
        const normalized = normalizeGenerationBaseUrl(profile.baseUrl);
        if (!normalized) {
          if (isVendorGatewayId(vendorId)) {
            setActiveVendorId(vendorId);
          }
          setError(canvas.byokBaseUrlInvalid);
          return;
        }
        nextProfiles[vendorId] = {
          baseUrl: normalized,
          apiKey: profile.apiKey.trim(),
          secretConfigured: profile.secretConfigured,
          ...(profile.name?.trim() || isCustomGatewayId(vendorId)
            ? {
                name:
                  profile.name?.trim() ||
                  (vendorId === CUSTOM_VENDOR_GATEWAY_ID
                    ? canvas.byokVendorCustom
                    : vendorId),
              }
            : {}),
        };
      } else {
        nextProfiles[vendorId] = {
          baseUrl: "",
          apiKey: profile.apiKey.trim(),
          secretConfigured: profile.secretConfigured,
          ...(profile.name?.trim() || isCustomGatewayId(vendorId)
            ? {
                name:
                  profile.name?.trim() ||
                  (vendorId === CUSTOM_VENDOR_GATEWAY_ID
                    ? canvas.byokVendorCustom
                    : vendorId),
              }
            : {}),
        };
      }
    }

    const models: ByokModelPreset[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const id = row.id.trim();
      if (!id) {
        setError(canvas.byokModelIdRequired);
        return;
      }
      if (seen.has(id)) {
        setError(canvas.byokModelDuplicate.replace("{id}", id));
        return;
      }
      seen.add(id);
      const displayName = row.displayName?.trim();
      const vendor = row.vendor?.trim();
      models.push({
        id,
        capability: row.capability,
        ...(displayName ? { displayName } : {}),
        ...(vendor ? { vendor } : {}),
      });
    }

    if (models.length === 0) {
      setError(canvas.byokModelsRequired);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await writeByokConfig({
        activeVendorId,
        profiles: nextProfiles,
        models,
      });
      setProfiles({
        ...emptyProfilesDraft(),
        ...saved.profiles,
      });
      onSaved();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : canvas.byokSaveFailed,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={canvas.modelSettings}
      size="5xl"
      closeLabel={messages.close}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {messages.cancel}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={saving || loading || pulling}
            onClick={() => {
              void handleSave();
            }}
          >
            {saving ? messages.loading : messages.save}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <PreferenceGroup title={canvas.byokVendorConnection}>
          <PreferenceRow
            label={canvas.byokVendorPresets}
            hint={canvas.byokVendorPresetsHint}
          >
            <PreferenceControl>
              <div className="flex w-full flex-col gap-2">
                <Select
                  id="canvas-byok-vendor"
                  value={activeVendorId}
                  options={vendorOptions}
                  onChange={handleSelectVendor}
                  disabled={loading}
                  placeholder={canvas.byokVendorPresets}
                  ariaLabel={canvas.byokVendorPresets}
                  className="w-full"
                  menuWidth="trigger"
                  menuZIndex={90}
                  triggerClassName={selectTriggerClassName()}
                  leading={
                    activeIsCustom ? undefined : (
                      <ModelNameWithLogo
                        name={vendorLabel(activeVendorId)}
                        matchParts={[activeVendorId]}
                        size={14}
                        nameClassName="sr-only"
                        className="pointer-events-none"
                      />
                    )
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={loading}
                    onClick={handleAddCustomGateway}
                  >
                    <Icon icon={Plus} size={13} />
                    {canvas.byokVendorAddCustom}
                  </Button>
                  {activeIsCustom ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={loading}
                      onClick={handleRemoveCustomGateway}
                    >
                      <Icon icon={Trash} size={13} />
                      {canvas.byokVendorRemoveCustom}
                    </Button>
                  ) : null}
                </div>
              </div>
            </PreferenceControl>
          </PreferenceRow>
          {activeIsCustom ? (
            <PreferenceRow label={canvas.byokVendorCustomName}>
              <PreferenceControl>
                <FormField
                  name={`canvas-byok-custom-name-${activeVendorId}`}
                  label={canvas.byokVendorCustomName}
                  value={activeProfile.name ?? ""}
                  placeholder={canvas.byokVendorCustomNamePlaceholder}
                  onChange={(value) => updateActiveProfile({ name: value })}
                />
              </PreferenceControl>
            </PreferenceRow>
          ) : null}
          <PreferenceRow
            label={canvas.byokBaseUrl}
            hint={canvas.byokBaseUrlHint}
          >
            <PreferenceControl>
              <FormField
                name={`canvas-byok-base-url-${activeVendorId}`}
                label={canvas.byokBaseUrl}
                value={activeProfile.baseUrl}
                placeholder="https://api.openai.com"
                onChange={(value) => updateActiveProfile({ baseUrl: value })}
              />
            </PreferenceControl>
          </PreferenceRow>
          <PreferenceRow
            label={canvas.byokApiKey}
            hint={canvas.byokApiKeyHint}
          >
            <PreferenceControl>
              <FormField
                name={`canvas-byok-api-key-${activeVendorId}`}
                label={canvas.byokApiKey}
                type="password"
                autoComplete="off"
                value={activeProfile.apiKey}
                placeholder={
                  activeProfile.secretConfigured
                    ? canvas.byokApiKeyConfiguredPlaceholder
                    : canvas.byokApiKeyPlaceholder
                }
                onChange={(value) => updateActiveProfile({ apiKey: value })}
              />
            </PreferenceControl>
          </PreferenceRow>
          <div className="flex justify-end border-t border-zinc-100 px-4 py-3 sm:px-5 dark:border-zinc-800">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pulling || loading}
              onClick={() => {
                void pullModels();
              }}
            >
              {pulling ? (
                <Loading variant="arc" size={14} label={canvas.byokPullingModels} />
              ) : (
                <Icon icon={ArrowClockwise} size={13} />
              )}
              {pulling ? canvas.byokPullingModels : canvas.byokPullModels}
            </Button>
          </div>
        </PreferenceGroup>

        <PreferenceGroup title={canvas.byokModels}>
          <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5 dark:border-zinc-800">
            <p className="text-[11px] leading-relaxed text-zinc-400">
              {canvas.byokModelsHint}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pulling || loading}
              onClick={() => setRows((current) => [...current, createRow()])}
            >
              <Icon icon={Plus} size={13} />
              {canvas.byokAddModel}
            </Button>
          </div>

          {rows.length === 0 ? (
            <Empty size="compact">{canvas.byokModelsEmpty}</Empty>
          ) : (
            <CompactFields>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rows.map((row) => (
                  <div
                    key={row.key}
                    className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[7.5rem_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_2rem] sm:items-end sm:px-5"
                  >
                    <SelectField
                      name={`capability-${row.key}`}
                      label={canvas.byokModelCapability}
                      value={row.capability}
                      onChange={(value) =>
                        updateRow(row.key, {
                          capability: value as ByokModelCapability,
                        })
                      }
                    >
                      {CAPABILITIES.map((capability) => (
                        <option key={capability} value={capability}>
                          {capability === "image"
                            ? canvas.byokCapabilityImage
                            : capability === "video"
                              ? canvas.byokCapabilityVideo
                              : canvas.byokCapabilityChat}
                        </option>
                      ))}
                    </SelectField>
                    <FormField
                      name={`id-${row.key}`}
                      label={canvas.byokModelId}
                      value={row.id}
                      placeholder={canvas.byokModelIdPlaceholder}
                      onChange={(value) => updateRow(row.key, { id: value })}
                    />
                    <FormField
                      name={`display-${row.key}`}
                      label={canvas.byokModelDisplayName}
                      value={row.displayName ?? ""}
                      placeholder={canvas.byokModelDisplayNamePlaceholder}
                      onChange={(value) =>
                        updateRow(row.key, { displayName: value })
                      }
                    />
                    <div className="min-w-0 space-y-1">
                      <label
                        htmlFor={`vendor-${row.key}`}
                        className="text-[11px] font-medium text-zinc-400"
                      >
                        {canvas.byokModelVendor}
                      </label>
                      <Select
                        id={`vendor-${row.key}`}
                        value={row.vendor?.trim() || EMPTY_VENDOR_VALUE}
                        options={modelVendorOptions}
                        size="compact"
                        menuWidth="trigger"
                        menuZIndex={90}
                        searchable={modelVendorOptions.length > 8}
                        className="w-full"
                        ariaLabel={canvas.byokModelVendor}
                        triggerClassName={selectTriggerClassName(
                          "soft",
                          "xs",
                          true,
                        )}
                        leading={
                          row.vendor
                            ? vendorSelectLeading(
                                row.vendor,
                                modelVendorOptions.find(
                                  (option) => option.value === row.vendor,
                                )?.label || vendorLabel(row.vendor),
                              )
                            : undefined
                        }
                        onChange={(value) =>
                          updateRow(row.key, {
                            vendor:
                              value === EMPTY_VENDOR_VALUE ? "" : value,
                          })
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="justify-self-end text-zinc-400 hover:text-red-500 sm:mb-0.5 sm:justify-self-center"
                      aria-label={canvas.byokRemoveModel}
                      onClick={() => removeRow(row.key)}
                    >
                      <Icon icon={Trash} size={13} />
                    </Button>
                  </div>
                ))}
              </div>
            </CompactFields>
          )}
        </PreferenceGroup>

        {error ? (
          <p className="px-1 text-xs text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
