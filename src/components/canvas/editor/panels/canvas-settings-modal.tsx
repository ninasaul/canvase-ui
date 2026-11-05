"use client";

import { Button } from "@/components/ui/button";
import {
  FieldSurface,
  FormField,
  SelectField,
  SwitchField,
} from "@/components/form-field";
import { Modal } from "@/components/ui/modal";
import { PlaygroundModelSelect } from "@/components/playground/playground-model-select";
import {
  PreferenceControl,
  PreferenceGroup,
  PreferenceRow,
} from "@/components/preference-list";
import { CanvasColorPicker } from "@/components/canvas/canvas-color-picker";
import { EDGE_COLOR_OPTIONS } from "../lib/constants";
import { useAgentComposerStore } from "@/lib/canvas/agent-composer-store";
import { messages } from "@/messages";
import { SkillsSettingsTab } from "@/components/canvas/editor/panels/skills-settings-tab";

import type { CanvasPreferences } from "@/lib/canvas/canvas-preferences";
import type { PortalPublicModel } from "@/types/admin";


import type { useCanvasSettings } from "../workspace/use-canvas-settings";

type SettingsState = ReturnType<typeof useCanvasSettings>;

/**
 * Canvas settings dialog: appearance/preferences, generation defaults and
 * object storage. All state lives in useCanvasSettings so the editor only
 * orchestrates open/save.
 */
export function CanvasSettingsModal({
  state,
  chatModels,
  imageModels,
  videoModels,
  imageDefaultParams,
  videoDefaultParams,
  onOpenAgentChat,
}: {
  state: SettingsState;
  chatModels: PortalPublicModel[];
  imageModels: PortalPublicModel[];
  videoModels: PortalPublicModel[];
  imageDefaultParams: Record<string, unknown>;
  videoDefaultParams: Record<string, unknown>;
  onOpenAgentChat?: () => void;
}) {
  const {
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
    storageSource,
    storageError,
    storageTesting,
    closeCanvasSettings,
    saveCanvasSettings,
    testCanvasStorage,
  } = state;

  if (!settingsOpen) {
    return null;
  }

  return (
  <Modal
    open={settingsOpen}
    onClose={closeCanvasSettings}
    title={messages.canvas.canvasSettings}
    size="5xl"
    closeLabel={messages.close}
    headerExtraLayout="below"
    headerExtra={
      <div className="inline-flex w-fit gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800/70">
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
            settingsTab === "canvas"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
          onClick={() => setSettingsTab("canvas")}
        >
          {messages.canvas.settingsTabCanvas}
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
            settingsTab === "generation"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
          onClick={() => setSettingsTab("generation")}
        >
          {messages.canvas.settingsTabGeneration}
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
            settingsTab === "storage"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
          onClick={() => setSettingsTab("storage")}
        >
          {messages.canvas.settingsTabStorage}
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
            settingsTab === "skills"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
          onClick={() => setSettingsTab("skills")}
        >
          {messages.canvas.settingsTabSkills}
        </button>
      </div>
    }
    footer={
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSettingsOpen(false)}
        >
          {settingsTab === "skills" ? messages.close : messages.canvas.cancel}
        </Button>
        {settingsTab === "storage" ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={settingsSaving || storageTesting}
            onClick={() => {
              void testCanvasStorage();
            }}
          >
            {storageTesting
              ? messages.loading
              : messages.canvas.storageTest}
          </Button>
        ) : null}
        {settingsTab === "skills" ? null : (
        <Button
          variant="primary"
          size="sm"
          disabled={settingsSaving || storageTesting}
          onClick={() => {
            void saveCanvasSettings();
          }}
        >
          {settingsSaving ? messages.loading : messages.canvas.saveSettings}
        </Button>
        )}
      </div>
    }
  >
    <FieldSurface>

      {settingsTab === "canvas" ? (
        <div className="space-y-5">
          <PreferenceGroup title={messages.canvas.viewAppearance}>
            <PreferenceRow
              label={messages.canvas.background}
              hint={messages.canvas.prefBackgroundHint}
            >
              <PreferenceControl>
                <SelectField
                  name="canvas-background"
                  label={messages.canvas.background}
                  value={preferencesDraft.background}
                  onChange={(value) =>
                    setPreferencesDraft((current) => ({
                      ...current,
                      background: value as CanvasPreferences["background"],
                    }))
                  }
                >
                  <option value="dots">
                    {messages.canvas.backgroundDots}
                  </option>
                  <option value="lines">
                    {messages.canvas.backgroundLines}
                  </option>
                  <option value="cross">
                    {messages.canvas.backgroundCross}
                  </option>
                  <option value="none">
                    {messages.canvas.backgroundNone}
                  </option>
                </SelectField>
              </PreferenceControl>
            </PreferenceRow>
            <PreferenceRow
              label={messages.canvas.backgroundGap}
              hint={messages.canvas.prefBackgroundGapHint}
            >
              <PreferenceControl>
                <SelectField
                  name="canvas-background-gap"
                  label={messages.canvas.backgroundGap}
                  value={String(preferencesDraft.backgroundGap)}
                  onChange={(value) =>
                    setPreferencesDraft((current) => ({
                      ...current,
                      backgroundGap: Number(value),
                    }))
                  }
                >
                  <option value="12">12</option>
                  <option value="18">18</option>
                  <option value="24">24</option>
                </SelectField>
              </PreferenceControl>
            </PreferenceRow>
            <PreferenceRow
              label={messages.canvas.nodeStyle}
              hint={messages.canvas.prefNodeStyleHint}
            >
              <PreferenceControl>
                <SelectField
                  name="canvas-node-style"
                  label={messages.canvas.nodeStyle}
                  value={preferencesDraft.nodeStyle}
                  onChange={(value) =>
                    setPreferencesDraft((current) => ({
                      ...current,
                      nodeStyle: value as CanvasPreferences["nodeStyle"],
                    }))
                  }
                >
                  <option value="card">
                    {messages.canvas.nodeStyleCard}
                  </option>
                  <option value="soft">
                    {messages.canvas.nodeStyleSoft}
                  </option>
                  <option value="outline">
                    {messages.canvas.nodeStyleOutline}
                  </option>
                  <option value="glass">
                    {messages.canvas.nodeStyleGlass}
                  </option>
                </SelectField>
              </PreferenceControl>
            </PreferenceRow>
            <div className="px-4 py-3.5 sm:px-5">
              <SwitchField
                name="canvas-minimap"
                description={messages.canvas.prefMiniMapHint}
                label={messages.canvas.showMiniMap}
                isSelected={preferencesDraft.showMiniMap}
                onChange={(value) =>
                  setPreferencesDraft((current) => ({
                    ...current,
                    showMiniMap: value,
                  }))
                }
              />
            </div>
            <div className="px-4 py-3.5 sm:px-5">
              <SwitchField
                name="canvas-audio-border"
                description={messages.canvas.prefAudioBorderHint}
                label={messages.canvas.audioPlayerBorder}
                isSelected={preferencesDraft.audioPlayerBorder}
                onChange={(value) =>
                  setPreferencesDraft((current) => ({
                    ...current,
                    audioPlayerBorder: value,
                  }))
                }
              />
            </div>
            <div className="px-4 py-3.5 sm:px-5">
              <SwitchField
                name="canvas-node-resize"
                description={messages.canvas.prefNodeResizeHint}
                label={messages.canvas.nodeResizeEnabled}
                isSelected={preferencesDraft.nodeResizeEnabled}
                onChange={(value) =>
                  setPreferencesDraft((current) => ({
                    ...current,
                    nodeResizeEnabled: value,
                  }))
                }
              />
            </div>
            <PreferenceRow
              label={messages.canvas.toolbarPosition}
              hint={messages.canvas.toolbarPositionHint}
            >
              <PreferenceControl>
                <SelectField
                  name="canvas-toolbar-position"
                  label={messages.canvas.toolbarPosition}
                  value={preferencesDraft.toolbarPosition}
                  onChange={(value) =>
                    setPreferencesDraft((current) => ({
                      ...current,
                      toolbarPosition:
                        value as CanvasPreferences["toolbarPosition"],
                    }))
                  }
                >
                  <option value="left">
                    {messages.canvas.toolbarPositionLeft}
                  </option>
                  <option value="right">
                    {messages.canvas.toolbarPositionRight}
                  </option>
                  <option value="bottom">
                    {messages.canvas.toolbarPositionBottom}
                  </option>
                </SelectField>
              </PreferenceControl>
            </PreferenceRow>
            <PreferenceRow
              label={messages.canvas.autoLayoutMode}
              hint={messages.canvas.prefAutoLayoutHint}
            >
              <PreferenceControl>
                <SelectField
                  name="canvas-auto-layout-mode"
                  label={messages.canvas.autoLayoutMode}
                  value={preferencesDraft.autoLayoutMode}
                  onChange={(value) =>
                    setPreferencesDraft((current) => ({
                      ...current,
                      autoLayoutMode:
                        value as CanvasPreferences["autoLayoutMode"],
                    }))
                  }
                >
                  <option value="layered-lr">
                    {messages.canvas.autoLayoutLayeredLr}
                  </option>
                  <option value="layered-tb">
                    {messages.canvas.autoLayoutLayeredTb}
                  </option>
                  <option value="grid">
                    {messages.canvas.autoLayoutGrid}
                  </option>
                </SelectField>
              </PreferenceControl>
            </PreferenceRow>
            <PreferenceRow
              label={messages.canvas.generationDockPlacement}
              hint={messages.canvas.prefDockPlacementHint}
            >
              <PreferenceControl>
                <SelectField
                  name="canvas-dock-placement"
                  label={messages.canvas.generationDockPlacement}
                  value={preferencesDraft.generationDockPlacement}
                  onChange={(value) =>
                    setPreferencesDraft((current) => ({
                      ...current,
                      generationDockPlacement:
                        value as CanvasPreferences["generationDockPlacement"],
                    }))
                  }
                >
                  <option value="canvas">
                    {messages.canvas.generationDockCanvas}
                  </option>
                  <option value="node">
                    {messages.canvas.generationDockNode}
                  </option>
                </SelectField>
              </PreferenceControl>
            </PreferenceRow>
          </PreferenceGroup>

          <PreferenceGroup title={messages.canvas.connectionLines}>
            <PreferenceRow
              label={messages.canvas.edgeType}
              hint={messages.canvas.prefEdgeTypeHint}
            >
              <PreferenceControl>
                <SelectField
                  name="canvas-edge-type"
                  label={messages.canvas.edgeType}
                  value={preferencesDraft.edgeType}
                  onChange={(value) =>
                    setPreferencesDraft((current) => ({
                      ...current,
                      edgeType: value as CanvasPreferences["edgeType"],
                    }))
                  }
                >
                  <option value="smoothstep">
                    {messages.canvas.edgeTypeSmooth}
                  </option>
                  <option value="bezier">
                    {messages.canvas.edgeTypeBezier}
                  </option>
                  <option value="straight">
                    {messages.canvas.edgeTypeStraight}
                  </option>
                </SelectField>
              </PreferenceControl>
            </PreferenceRow>
            <PreferenceRow
              label={messages.canvas.edgeColor}
              hint={messages.canvas.prefEdgeColorHint}
            >
              <CanvasColorPicker
                label={messages.canvas.edgeColor}
                value={preferencesDraft.edgeColor}
                options={EDGE_COLOR_OPTIONS}
                onChange={(value) =>
                  setPreferencesDraft((current) => ({
                    ...current,
                    edgeColor: value,
                  }))
                }
              />
            </PreferenceRow>
            <PreferenceRow
              label={messages.canvas.edgeWidth}
              hint={messages.canvas.prefEdgeWidthHint}
            >
              <PreferenceControl>
                <SelectField
                  name="canvas-edge-width"
                  label={messages.canvas.edgeWidth}
                  value={String(preferencesDraft.edgeWidth)}
                  onChange={(value) =>
                    setPreferencesDraft((current) => ({
                      ...current,
                      edgeWidth: Number(value),
                    }))
                  }
                >
                  {[0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4].map((width) => (
                    <option key={width} value={String(width)}>
                      {width} px
                    </option>
                  ))}
                </SelectField>
              </PreferenceControl>
            </PreferenceRow>
            <PreferenceRow
              label={messages.canvas.edgeLineStyle}
              hint={messages.canvas.prefEdgeLineStyleHint}
            >
              <PreferenceControl>
                <SelectField
                  name="canvas-edge-line-style"
                  label={messages.canvas.edgeLineStyle}
                  value={preferencesDraft.edgeLineStyle}
                  onChange={(value) =>
                    setPreferencesDraft((current) => ({
                      ...current,
                      edgeLineStyle:
                        value as CanvasPreferences["edgeLineStyle"],
                    }))
                  }
                >
                  <option value="solid">
                    {messages.canvas.edgeLineSolid}
                  </option>
                  <option value="dashed">
                    {messages.canvas.edgeLineDashed}
                  </option>
                  <option value="dotted">
                    {messages.canvas.edgeLineDotted}
                  </option>
                </SelectField>
              </PreferenceControl>
            </PreferenceRow>
            <div className="px-4 py-3.5 sm:px-5">
              <SwitchField
                name="canvas-animate-edges"
                description={messages.canvas.prefAnimateEdgesHint}
                label={messages.canvas.animateEdges}
                isSelected={preferencesDraft.animateEdges}
                onChange={(value) =>
                  setPreferencesDraft((current) => ({
                    ...current,
                    animateEdges: value,
                  }))
                }
              />
            </div>
            <PreferenceRow
              label={messages.canvas.handleStyle}
              hint={messages.canvas.prefHandleStyleHint}
            >
              <PreferenceControl>
                <SelectField
                  name="canvas-handle-style"
                  label={messages.canvas.handleStyle}
                  value={preferencesDraft.handleStyle}
                  onChange={(value) =>
                    setPreferencesDraft((current) => ({
                      ...current,
                      handleStyle: value as CanvasPreferences["handleStyle"],
                    }))
                  }
                >
                  <option value="plus">
                    {messages.canvas.handleStylePlus}
                  </option>
                  <option value="dot">
                    {messages.canvas.handleStyleDot}
                  </option>
                  <option value="ring">
                    {messages.canvas.handleStyleRing}
                  </option>
                  <option value="arrow">
                    {messages.canvas.handleStyleArrow}
                  </option>
                </SelectField>
              </PreferenceControl>
            </PreferenceRow>
          </PreferenceGroup>

          <PreferenceGroup title={messages.canvas.interaction}>
            <div className="px-4 py-3.5 sm:px-5">
              <SwitchField
                name="canvas-helper-lines"
                description={messages.canvas.prefHelperLinesHint}
                label={messages.canvas.showHelperLines}
                isSelected={preferencesDraft.showHelperLines}
                onChange={(value) =>
                  setPreferencesDraft((current) => ({
                    ...current,
                    showHelperLines: value,
                  }))
                }
              />
            </div>
            <div className="px-4 py-3.5 sm:px-5">
              <SwitchField
                name="canvas-auto-connect"
                description={messages.canvas.prefAutoConnectHint}
                label={messages.canvas.autoConnect}
                isSelected={preferencesDraft.autoConnect}
                onChange={(value) =>
                  setPreferencesDraft((current) => ({
                    ...current,
                    autoConnect: value,
                  }))
                }
              />
            </div>
          </PreferenceGroup>
        </div>
      ) : settingsTab === "skills" ? (
        <SkillsSettingsTab
          onInsert={(skill) => {
            useAgentComposerStore.getState().queueSkill({
              id: skill.id,
              name: skill.name,
              content: skill.content,
            });
            setSettingsOpen(false);
            onOpenAgentChat?.();
          }}
        />
      ) : settingsTab === "storage" ? (
        <div className="space-y-5">
          <PreferenceGroup title={messages.canvas.storageTitle}>
            <p className="px-4 pt-3 text-xs text-zinc-500 sm:px-5 dark:text-zinc-400">
              {messages.canvas.storageHint}
              {storageSource === "env"
                ? ` (${messages.canvas.settingsTabStorage}: env)`
                : storageSource === "user"
                  ? ` (${messages.canvas.settingsTabStorage}: user)`
                  : ""}
            </p>
            <PreferenceRow
              label={messages.canvas.storageEndpoint}
              hint={messages.canvas.storageEndpointHint}
            >
              <PreferenceControl>
                <FormField
                  name="canvas-storage-endpoint"
                  label={messages.canvas.storageEndpoint}
                  value={storageEndpointDraft}
                  placeholder="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
                  onChange={setStorageEndpointDraft}
                />
              </PreferenceControl>
            </PreferenceRow>
            <PreferenceRow
              label={messages.canvas.storageRegion}
              hint={messages.canvas.storageRegionHint}
            >
              <PreferenceControl>
                <FormField
                  name="canvas-storage-region"
                  label={messages.canvas.storageRegion}
                  value={storageRegionDraft}
                  placeholder="auto"
                  onChange={setStorageRegionDraft}
                />
              </PreferenceControl>
            </PreferenceRow>
            <PreferenceRow label={messages.canvas.storageBucket}>
              <PreferenceControl>
                <FormField
                  name="canvas-storage-bucket"
                  label={messages.canvas.storageBucket}
                  value={storageBucketDraft}
                  placeholder="canvase-media"
                  onChange={setStorageBucketDraft}
                />
              </PreferenceControl>
            </PreferenceRow>
            <PreferenceRow label={messages.canvas.storageAccessKeyId}>
              <PreferenceControl>
                <FormField
                  name="canvas-storage-access-key"
                  label={messages.canvas.storageAccessKeyId}
                  value={storageAccessKeyIdDraft}
                  placeholder="AKIA..."
                  onChange={setStorageAccessKeyIdDraft}
                />
              </PreferenceControl>
            </PreferenceRow>
            <PreferenceRow
              label={messages.canvas.storageSecretAccessKey}
              hint={messages.canvas.storageSecretAccessKeyHint}
            >
              <PreferenceControl>
                <FormField
                  name="canvas-storage-secret"
                  label={messages.canvas.storageSecretAccessKey}
                  type="password"
                  value={storageSecretDraft}
                  placeholder={
                    storageSecretConfigured ? "********" : undefined
                  }
                  onChange={setStorageSecretDraft}
                />
              </PreferenceControl>
            </PreferenceRow>
            <PreferenceRow
              label={messages.canvas.storagePublicBaseUrl}
              hint={messages.canvas.storagePublicBaseUrlHint}
            >
              <PreferenceControl>
                <FormField
                  name="canvas-storage-public-base-url"
                  label={messages.canvas.storagePublicBaseUrl}
                  value={storagePublicBaseUrlDraft}
                  placeholder="https://cdn.example.com"
                  onChange={setStoragePublicBaseUrlDraft}
                />
              </PreferenceControl>
            </PreferenceRow>
            <div className="px-4 py-3.5 sm:px-5">
              <SwitchField
                name="canvas-storage-force-path-style"
                description={messages.canvas.storageForcePathStyleHint}
                label={messages.canvas.storageForcePathStyle}
                isSelected={storageForcePathStyleDraft}
                onChange={setStorageForcePathStyleDraft}
              />
            </div>
          </PreferenceGroup>
          {storageError ? (
            <p className="px-1 text-xs text-red-600 dark:text-red-400">
              {storageError}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5">
        <PreferenceGroup title={messages.canvas.defaultImage}>
          <PreferenceRow
              label={messages.canvas.defaultModel}
              hint={messages.canvas.prefDefaultModelHint}
            >
            <PreferenceControl>
              {imageModels.length > 0 ? (
                <PlaygroundModelSelect
                  models={imageModels}
                  value={settingsDraft.image?.model ?? ""}
                  menuZIndex={90}
                  className="w-full"
                  onChange={(model) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      image: {
                        ...current.image,
                        model,
                        vendor: imageModels.find((item) => item.id === model)
                          ?.vendor,
                      },
                    }))
                  }
                />
              ) : (
                <span className="text-xs text-zinc-400">
                  {messages.canvas.noModel}
                </span>
              )}
            </PreferenceControl>
          </PreferenceRow>
          <PreferenceRow
              label={messages.canvas.defaultRatio}
              hint={messages.canvas.prefDefaultRatioHint}
            >
            <PreferenceControl>
              <SelectField
                name="canvas-image-default-ratio"
                label={messages.canvas.defaultRatio}
                value={(imageDefaultParams.aspectRatio as string) ?? "1:1"}
                onChange={(value) =>
                  setSettingsDraft((current) => ({
                    ...current,
                    image: {
                      ...current.image,
                      params: {
                        ...current.image?.params,
                        aspectRatio: value,
                      },
                    },
                  }))
                }
              >
                {["1:1", "16:9", "9:16", "4:3", "3:4"].map((ratio) => (
                  <option key={ratio} value={ratio}>
                    {ratio}
                  </option>
                ))}
              </SelectField>
            </PreferenceControl>
          </PreferenceRow>
        </PreferenceGroup>

        <PreferenceGroup title={messages.canvas.defaultVideo}>
          <PreferenceRow
              label={messages.canvas.defaultModel}
              hint={messages.canvas.prefDefaultModelHint}
            >
            <PreferenceControl>
              {videoModels.length > 0 ? (
                <PlaygroundModelSelect
                  models={videoModels}
                  value={settingsDraft.video?.model ?? ""}
                  menuZIndex={90}
                  className="w-full"
                  onChange={(model) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      video: {
                        ...current.video,
                        model,
                        vendor: videoModels.find((item) => item.id === model)
                          ?.vendor,
                      },
                    }))
                  }
                />
              ) : (
                <span className="text-xs text-zinc-400">
                  {messages.canvas.noModel}
                </span>
              )}
            </PreferenceControl>
          </PreferenceRow>
          <PreferenceRow
              label={messages.canvas.defaultRatio}
              hint={messages.canvas.prefDefaultRatioHint}
            >
            <PreferenceControl>
              <SelectField
                name="canvas-video-default-ratio"
                label={messages.canvas.defaultRatio}
                value={(videoDefaultParams.ratio as string) ?? "16:9"}
                onChange={(value) =>
                  setSettingsDraft((current) => ({
                    ...current,
                    video: {
                      ...current.video,
                      params: {
                        ...current.video?.params,
                        ratio: value,
                      },
                    },
                  }))
                }
              >
                {["16:9", "9:16", "1:1"].map((ratio) => (
                  <option key={ratio} value={ratio}>
                    {ratio}
                  </option>
                ))}
              </SelectField>
            </PreferenceControl>
          </PreferenceRow>
          <PreferenceRow
              label={messages.canvas.defaultDuration}
              hint={messages.canvas.prefDefaultDurationHint}
            >
            <PreferenceControl>
              <SelectField
                name="canvas-video-default-duration"
                label={messages.canvas.defaultDuration}
                value={(videoDefaultParams.duration as string) ?? "5"}
                onChange={(value) =>
                  setSettingsDraft((current) => ({
                    ...current,
                    video: {
                      ...current.video,
                      params: {
                        ...current.video?.params,
                        duration: value,
                      },
                    },
                  }))
                }
              >
                {["5", "10"].map((duration) => (
                  <option key={duration} value={duration}>
                    {duration}s
                  </option>
                ))}
              </SelectField>
            </PreferenceControl>
          </PreferenceRow>
        </PreferenceGroup>

        <PreferenceGroup title={messages.canvas.defaultText}>
          <PreferenceRow
              label={messages.canvas.defaultModel}
              hint={messages.canvas.prefDefaultModelHint}
            >
            <PreferenceControl>
              {chatModels.length > 0 ? (
                <PlaygroundModelSelect
                  models={chatModels}
                  value={settingsDraft.text?.model ?? ""}
                  menuZIndex={90}
                  className="w-full"
                  onChange={(model) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      text: {
                        ...current.text,
                        model,
                        vendor: chatModels.find((item) => item.id === model)
                          ?.vendor,
                      },
                    }))
                  }
                />
              ) : (
                <span className="text-xs text-zinc-400">
                  {messages.canvas.noModel}
                </span>
              )}
            </PreferenceControl>
          </PreferenceRow>
        </PreferenceGroup>

        </div>
      )}
    </FieldSurface>
  </Modal>
  );
}
