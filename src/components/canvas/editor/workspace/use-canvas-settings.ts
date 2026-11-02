"use client";

import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import { toast } from "@/components/ui/toast";
import {
  DEFAULT_CANVAS_PREFERENCES,
  type CanvasPreferences,
} from "@/lib/canvas/canvas-preferences";
import {
  readStorageConfig,
  testStorageConfig,
  writeStorageConfig,
} from "@/lib/storage/storage-config-client";
import type { CanvasSettings } from "@/lib/tu-shared-browser";
import { messages } from "@/messages";

import type { CanvasSettingsTab } from "../lib/constants";

/** Storage endpoints that are still the placeholder from the docs. */
const PLACEHOLDER_ENDPOINT =
  /:\/\/xxx\.|<account|accountid|example\.com|changeme/i;

/**
 * State and effects behind the canvas settings dialog: drafts for settings,
 * preferences and storage, plus the storage test/save flows. The editor only
 * renders; moving the dialog into its own component later becomes mechanical.
 */
export function useCanvasSettings(input: {
  settings: CanvasSettings;
  preferences: CanvasPreferences;
  setSettings: (next: CanvasSettings) => void;
  setPreferences: Dispatch<SetStateAction<CanvasPreferences>>;
}) {
  const { settings, preferences, setSettings, setPreferences } = input;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<CanvasSettingsTab>("canvas");
  const [settingsDraft, setSettingsDraft] = useState<CanvasSettings>({});
  const [preferencesDraft, setPreferencesDraft] = useState<CanvasPreferences>(
    DEFAULT_CANVAS_PREFERENCES,
  );
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [storageEndpointDraft, setStorageEndpointDraft] = useState("");
  const [storageRegionDraft, setStorageRegionDraft] = useState("auto");
  const [storageBucketDraft, setStorageBucketDraft] = useState("");
  const [storageAccessKeyIdDraft, setStorageAccessKeyIdDraft] = useState("");
  const [storageSecretDraft, setStorageSecretDraft] = useState("");
  const [storagePublicBaseUrlDraft, setStoragePublicBaseUrlDraft] =
    useState("");
  const [storageForcePathStyleDraft, setStorageForcePathStyleDraft] =
    useState(true);
  const [storageSecretConfigured, setStorageSecretConfigured] = useState(false);
  const [storageSource, setStorageSource] = useState<"user" | "env" | "none">(
    "none",
  );
  const [storageConfigured, setStorageConfigured] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageTesting, setStorageTesting] = useState(false);

  // Storage badge on the settings entry point is known before the dialog opens.
  useEffect(() => {
    void readStorageConfig()
      .then((storage) => {
        setStorageConfigured(storage.configured);
        setStorageSource(storage.source);
      })
      .catch(() => {
        setStorageConfigured(false);
      });
  }, []);

  /** Opens the dialog on a tab and hydrates the storage form. */
  const openCanvasSettings = useCallback(
    (tab: CanvasSettingsTab) => {
      setSettingsDraft(settings);
      setPreferencesDraft(preferences);
      setSettingsTab(tab);
      setStorageError(null);
      setSettingsOpen(true);
      void (async () => {
        try {
          const storage = await readStorageConfig();
          setStorageSource(storage.source);
          setStorageConfigured(storage.configured);
          setStorageSecretConfigured(storage.secretConfigured);
          setStorageEndpointDraft(storage.endpoint);
          setStorageRegionDraft(storage.region || "auto");
          setStorageBucketDraft(storage.bucket);
          setStorageAccessKeyIdDraft(
            storage.source === "user" ? storage.accessKeyId : "",
          );
          setStorageSecretDraft("");
          setStoragePublicBaseUrlDraft(storage.publicBaseUrl);
          setStorageForcePathStyleDraft(storage.forcePathStyle);
        } catch {
          // keep previous storage drafts
        }
      })();
    },
    [preferences, settings],
  );

  const closeCanvasSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  /** Validates and persists the storage tab, or applies settings/preferences. */
  const saveCanvasSettings = useCallback(async () => {
    const storageEndpoint = storageEndpointDraft.trim();
    if (settingsTab === "storage") {
      const missingSecret =
        !storageSecretDraft.trim() && !storageSecretConfigured;
      if (
        !storageEndpoint ||
        !storageBucketDraft.trim() ||
        !storageAccessKeyIdDraft.trim() ||
        !storagePublicBaseUrlDraft.trim() ||
        missingSecret
      ) {
        setStorageError(messages.canvas.storageRequired);
        return;
      }
      if (PLACEHOLDER_ENDPOINT.test(storageEndpoint)) {
        setStorageError(messages.canvas.storagePlaceholderEndpoint);
        return;
      }
    }

    setSettingsSaving(true);
    setStorageError(null);
    try {
      if (settingsTab === "storage") {
        const saved = await writeStorageConfig({
          endpoint: storageEndpoint,
          region: storageRegionDraft.trim() || "auto",
          bucket: storageBucketDraft.trim(),
          accessKeyId: storageAccessKeyIdDraft.trim(),
          secretAccessKey: storageSecretDraft.trim() || undefined,
          publicBaseUrl: storagePublicBaseUrlDraft.trim(),
          forcePathStyle: storageForcePathStyleDraft,
        });
        setStorageConfigured(saved.configured);
        setStorageSource(saved.source);
        setStorageSecretConfigured(saved.secretConfigured);
        setStorageSecretDraft("");
      } else {
        setSettings(settingsDraft);
        setPreferences({
          ...preferencesDraft,
          snapToGrid: preferences.snapToGrid,
        });
      }
      setSettingsOpen(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : null;
      setStorageError(message ?? messages.canvas.storageSaveFailed);
    } finally {
      setSettingsSaving(false);
    }
  }, [
    preferences.snapToGrid,
    preferencesDraft,
    setPreferences,
    setSettings,
    settingsDraft,
    settingsTab,
    storageAccessKeyIdDraft,
    storageBucketDraft,
    storageEndpointDraft,
    storageForcePathStyleDraft,
    storagePublicBaseUrlDraft,
    storageRegionDraft,
    storageSecretConfigured,
    storageSecretDraft,
  ]);

  /** Round-trips the storage form against the bucket. */
  const testCanvasStorage = useCallback(async () => {
    const storageEndpoint = storageEndpointDraft.trim();
    const missingSecret =
      !storageSecretDraft.trim() &&
      !storageSecretConfigured &&
      storageSource !== "env";
    if (
      !storageEndpoint ||
      !storageBucketDraft.trim() ||
      !storageAccessKeyIdDraft.trim() ||
      !storagePublicBaseUrlDraft.trim() ||
      missingSecret
    ) {
      setStorageError(messages.canvas.storageRequired);
      return;
    }
    if (PLACEHOLDER_ENDPOINT.test(storageEndpoint)) {
      setStorageError(messages.canvas.storagePlaceholderEndpoint);
      return;
    }

    setStorageTesting(true);
    setStorageError(null);
    try {
      await testStorageConfig({
        endpoint: storageEndpoint,
        region: storageRegionDraft.trim() || "auto",
        bucket: storageBucketDraft.trim(),
        accessKeyId: storageAccessKeyIdDraft.trim(),
        secretAccessKey: storageSecretDraft.trim() || undefined,
        publicBaseUrl: storagePublicBaseUrlDraft.trim(),
        forcePathStyle: storageForcePathStyleDraft,
      });
      toast.success(messages.canvas.storageTestOk);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : null;
      setStorageError(message ?? messages.canvas.storageTestFailed);
      toast.danger(message ?? messages.canvas.storageTestFailed);
    } finally {
      setStorageTesting(false);
    }
  }, [
    storageAccessKeyIdDraft,
    storageBucketDraft,
    storageEndpointDraft,
    storageForcePathStyleDraft,
    storagePublicBaseUrlDraft,
    storageRegionDraft,
    storageSecretConfigured,
    storageSecretDraft,
    storageSource,
  ]);

  return {
    settingsOpen,
    setSettingsOpen,
    settingsTab,
    setSettingsTab,
    settingsDraft,
    setSettingsDraft,
    preferencesDraft,
    setPreferencesDraft,
    settingsSaving,
    storageEndpointDraft,
    setStorageEndpointDraft,
    storageRegionDraft,
    setStorageRegionDraft,
    storageBucketDraft,
    setStorageBucketDraft,
    storageAccessKeyIdDraft,
    setStorageAccessKeyIdDraft,
    storageSecretDraft,
    setStorageSecretDraft,
    storagePublicBaseUrlDraft,
    setStoragePublicBaseUrlDraft,
    storageForcePathStyleDraft,
    setStorageForcePathStyleDraft,
    storageSecretConfigured,
    setStorageSecretConfigured,
    storageSource,
    setStorageSource,
    storageConfigured,
    setStorageConfigured,
    storageError,
    setStorageError,
    storageTesting,
    setStorageTesting,
    openCanvasSettings,
    closeCanvasSettings,
    saveCanvasSettings,
    testCanvasStorage,
  };
}
