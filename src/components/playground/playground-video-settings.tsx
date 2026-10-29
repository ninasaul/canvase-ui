"use client";

import { useMemo } from "react";
import { OptionRadioGroup } from "@/components/ui/option-radio-group";
import {
  PlaygroundParamField,
  PlaygroundParamGrid,
  PlaygroundParamHeader,
  PlaygroundParamSlider,
  PlaygroundParamSwitch,
  PlaygroundSettingsShell,
} from "@/components/playground/playground-param-primitives";
import {
  isWan3ImageOnlyModel,
  type ModelIdentity,
} from "@canvase/generation-params/model-families";
import {
  playgroundFamilyLabel,
  toRadioOptions,
} from "@/lib/playground/param-options";
import {
  toAspectRatioOptions,
  toResolutionOptions,
} from "@/lib/playground/size-option-icons";
import {
  getVideoCapabilityProfile,
  getVideoDurationSpec,
  resolveVideoSanitizeMediaFlags,
  sanitizeVideoParams,
  type PlaygroundVideoParams,
  type VideoDurationSpec,
} from "@canvase/generation-params/video";
import { messages } from "@/messages";

type PlaygroundVideoSettingsProps = {
  formId: string;
  model: ModelIdentity;
  params: PlaygroundVideoParams;
  hasReferenceImage: boolean;
  disabled?: boolean;
  embedded?: boolean;
  onChange: (params: PlaygroundVideoParams) => void;
};

/** Practical slider range; 0 means random / unset. */
const SEED_SLIDER_MAX = 999_999;

function snapDuration(value: number, spec: VideoDurationSpec): number {
  if (spec.type === "enum") {
    return spec.values.reduce((best, item) =>
      Math.abs(item - value) < Math.abs(best - value) ? item : best,
    );
  }
  return Math.min(spec.max, Math.max(spec.min, value));
}

function durationBounds(spec: VideoDurationSpec): {
  min: number;
  max: number;
  step: number;
} {
  if (spec.type === "enum") {
    const min = Math.min(...spec.values);
    const max = Math.max(...spec.values);
    const step =
      spec.values.length > 1
        ? Math.min(
            ...spec.values.slice(1).map((value, index) => value - spec.values[index]!),
          )
        : 1;
    return { min, max, step: Math.max(1, step) };
  }
  return { min: spec.min, max: spec.max, step: 1 };
}

function seedSliderValue(raw: string): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.min(SEED_SLIDER_MAX, parsed);
}

export function PlaygroundVideoSettings({
  formId,
  model,
  params,
  hasReferenceImage,
  disabled,
  embedded = false,
  onChange,
}: PlaygroundVideoSettingsProps) {
  const profile = getVideoCapabilityProfile(model);
  const mediaFlags = resolveVideoSanitizeMediaFlags(
    model,
    params,
    hasReferenceImage,
  );
  const frameLocksAdaptive = mediaFlags.hasFrameImage;
  const safeParams = sanitizeVideoParams(model, params, mediaFlags);
  const durationSpec = getVideoDurationSpec(model);
  const durationLocked = profile.lockedDuration !== null;
  const resolutionLocked = profile.lockedResolution !== null;
  const durationLimits = durationBounds(durationSpec);
  const durationValue = snapDuration(
    Number.parseInt(safeParams.duration, 10) || durationLimits.min,
    durationSpec,
  );
  const seedValue = seedSliderValue(safeParams.seed);

  const ratioOptions = useMemo(() => {
    if (profile.family !== "minimax-h3") {
      return toAspectRatioOptions(profile.ratios);
    }
    if (frameLocksAdaptive) {
      return toAspectRatioOptions(["adaptive"]);
    }
    if (!hasReferenceImage) {
      return toAspectRatioOptions(
        profile.ratios.filter((value) => value !== "adaptive"),
      );
    }
    return toAspectRatioOptions(profile.ratios);
  }, [frameLocksAdaptive, hasReferenceImage, profile.family, profile.ratios]);

  return (
    <PlaygroundSettingsShell embedded={embedded}>
      <PlaygroundParamHeader
        embedded={embedded}
        familyLabel={playgroundFamilyLabel(
          isWan3ImageOnlyModel(model) ? "wan3-image" : profile.family,
        )}
      />

      <PlaygroundParamGrid>
        <PlaygroundParamField
          label={messages.playground.ratio}
          htmlFor={`${formId}-ratio`}
        >
          <OptionRadioGroup
            id={`${formId}-ratio`}
            layout="grid"
            value={safeParams.ratio}
            options={ratioOptions}
            disabled={disabled}
            aria-label={messages.playground.ratio}
            onChange={(value) => onChange({ ...params, ratio: value })}
          />
        </PlaygroundParamField>

        {profile.showKlingMode ? (
          <PlaygroundParamField
            label={messages.playground.klingMode}
            htmlFor={`${formId}-kling-mode`}
          >
            <OptionRadioGroup
              id={`${formId}-kling-mode`}
              layout="grid"
              value={safeParams.klingMode}
              options={toRadioOptions(
                resolutionLocked ? [safeParams.klingMode] : ["std", "pro", "4k"],
              )}
              disabled={disabled || resolutionLocked}
              aria-label={messages.playground.klingMode}
              onChange={(value) => onChange({ ...params, klingMode: value })}
            />
          </PlaygroundParamField>
        ) : (
          <PlaygroundParamField
            label={messages.playground.resolution}
            htmlFor={`${formId}-resolution`}
          >
            <OptionRadioGroup
              id={`${formId}-resolution`}
              layout="grid"
              value={safeParams.resolution}
              options={toResolutionOptions(profile.resolutions)}
              disabled={disabled || resolutionLocked}
              aria-label={messages.playground.resolution}
              onChange={(value) => onChange({ ...params, resolution: value })}
            />
          </PlaygroundParamField>
        )}

        <PlaygroundParamSlider
          id={`${formId}-duration`}
          label={messages.playground.duration}
          min={durationLimits.min}
          max={durationLimits.max}
          step={durationLimits.step}
          value={durationValue}
          disabled={
            disabled || durationLocked || durationLimits.min >= durationLimits.max
          }
          formatValue={(next) => `${next}s`}
          onChange={(next) =>
            onChange({
              ...params,
              duration: String(snapDuration(next, durationSpec)),
            })
          }
        />

        {profile.showGenerateAudio ? (
          <PlaygroundParamSwitch
            id={`${formId}-generate-audio`}
            label={messages.playground.generateAudio}
            checked={safeParams.generateAudio}
            disabled={disabled}
            onChange={(checked) =>
              onChange({ ...params, generateAudio: checked })
            }
          />
        ) : null}
        {profile.showWatermark ? (
          <PlaygroundParamSwitch
            id={`${formId}-watermark`}
            label={messages.playground.watermark}
            checked={safeParams.watermark}
            disabled={disabled}
            onChange={(checked) => onChange({ ...params, watermark: checked })}
          />
        ) : null}
        {profile.showCameraFixed ? (
          <PlaygroundParamSwitch
            id={`${formId}-camera-fixed`}
            label={messages.playground.cameraFixed}
            checked={safeParams.cameraFixed}
            disabled={disabled}
            onChange={(checked) =>
              onChange({ ...params, cameraFixed: checked })
            }
          />
        ) : null}
        {profile.showDraftMode ? (
          <PlaygroundParamSwitch
            id={`${formId}-draft`}
            label={messages.playground.draftMode}
            checked={safeParams.draftMode}
            disabled={disabled}
            onChange={(checked) => onChange({ ...params, draftMode: checked })}
          />
        ) : null}
        {profile.supportsSeed ? (
          <PlaygroundParamSlider
            id={`${formId}-seed`}
            label={messages.playground.seed}
            min={0}
            max={SEED_SLIDER_MAX}
            step={1}
            value={seedValue}
            disabled={disabled}
            formatValue={(next) =>
              next <= 0 ? messages.playground.seedRandom : String(next)
            }
            onChange={(next) =>
              onChange({
                ...params,
                seed: next <= 0 ? "" : String(Math.round(next)),
              })
            }
          />
        ) : null}
      </PlaygroundParamGrid>
    </PlaygroundSettingsShell>
  );
}
