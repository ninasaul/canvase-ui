"use client";

import { Input } from "@/components/ui/input";
import { OptionRadioGroup } from "@/components/ui/option-radio-group";
import {
  PlaygroundParamField,
  PlaygroundParamGrid,
  PlaygroundParamSlider,
  PlaygroundParamSwitch,
  PlaygroundSettingsShell,
} from "@/components/playground/playground-param-primitives";
import {
  getImageCapabilityProfile,
  sanitizeImageParams,
  type ImagePlaygroundModel,
  type PlaygroundImageParams,
} from "@canvase/generation-params/image";
import {
  toAspectRatioOptions,
  toPixelSizeOptions,
  toSizeTierOptions,
} from "@/lib/playground/size-option-icons";
import { messages } from "@/messages";

type PlaygroundImageSettingsProps = {
  formId: string;
  model: ImagePlaygroundModel;
  params: PlaygroundImageParams;
  disabled?: boolean;
  embedded?: boolean;
  onChange: (params: PlaygroundImageParams) => void;
};

function toOpenAiQualityOptions(values: readonly string[]) {
  const labels = messages.playground.openAiQualityLabels;
  return values.map((value) => ({
    value,
    label: labels[value as keyof typeof labels] ?? value,
  }));
}

function toOpenAiBackgroundOptions(values: readonly string[]) {
  const labels = messages.playground.openAiBackgroundLabels;
  return values.map((value) => ({
    value,
    label: labels[value as keyof typeof labels] ?? value,
  }));
}

function toOpenAiModerationOptions(values: readonly string[]) {
  const labels = messages.playground.openAiModerationLabels;
  return values.map((value) => ({
    value,
    label: labels[value as keyof typeof labels] ?? value,
  }));
}

export function PlaygroundImageSettings({
  formId,
  model,
  params,
  disabled,
  embedded = false,
  onChange,
}: PlaygroundImageSettingsProps) {
  const profile = getImageCapabilityProfile(model);
  const safeParams = sanitizeImageParams(model, params);
  const imageCount = Math.min(
    profile.maxCount,
    Math.max(1, Number.parseInt(safeParams.count, 10) || 1),
  );
  const showSizeField =
    (profile.sizeOptionStyle !== "ratio" || !profile.lockedAspectRatio) &&
    (profile.sizes.length > 0 || profile.allowCustomSize);
  const sizeLabel =
    profile.sizeOptionStyle === "ratio"
      ? messages.playground.aspectRatio
      : profile.sizeOptionStyle === "tier"
        ? messages.playground.sizeTier
        : messages.playground.size;

  return (
    <PlaygroundSettingsShell embedded={embedded}>
      <PlaygroundParamGrid>
        {showSizeField ? (
          <PlaygroundParamField label={sizeLabel} htmlFor={`${formId}-size`}>
            {profile.allowCustomSize ? (
              <Input
                id={`${formId}-size`}
                size="sm"
                value={safeParams.size}
                disabled={disabled}
                placeholder="1024x1024"
                onChange={(event) =>
                  onChange({ ...params, size: event.target.value })
                }
              />
            ) : (
              <OptionRadioGroup
                id={`${formId}-size`}
                layout="grid"
                value={safeParams.size}
                options={
                  profile.sizeOptionStyle === "tier"
                    ? toSizeTierOptions(profile.sizes)
                    : profile.sizeOptionStyle === "ratio"
                      ? toAspectRatioOptions(profile.sizes)
                      : toPixelSizeOptions(profile.sizes)
                }
                disabled={disabled}
                aria-label={sizeLabel}
                onChange={(value) => onChange({ ...params, size: value })}
              />
            )}
          </PlaygroundParamField>
        ) : null}

        {profile.showAspectRatio ? (
          <PlaygroundParamField
            label={messages.playground.aspectRatio}
            htmlFor={`${formId}-aspect-ratio`}
          >
            <OptionRadioGroup
              id={`${formId}-aspect-ratio`}
              layout="grid"
              value={safeParams.aspectRatio}
              options={toAspectRatioOptions(profile.aspectRatios)}
              disabled={disabled}
              aria-label={messages.playground.aspectRatio}
              onChange={(value) => onChange({ ...params, aspectRatio: value })}
            />
          </PlaygroundParamField>
        ) : null}

        {profile.showQuality ? (
          <PlaygroundParamField
            label={messages.playground.quality}
            htmlFor={`${formId}-quality`}
          >
            <OptionRadioGroup
              id={`${formId}-quality`}
              layout="grid"
              value={safeParams.quality}
              options={toOpenAiQualityOptions(profile.qualityOptions)}
              disabled={disabled}
              aria-label={messages.playground.quality}
              onChange={(value) => onChange({ ...params, quality: value })}
            />
          </PlaygroundParamField>
        ) : null}

        {profile.showBackground ? (
          <PlaygroundParamField
            label={messages.playground.background}
            htmlFor={`${formId}-background`}
          >
            <OptionRadioGroup
              id={`${formId}-background`}
              layout="grid"
              value={safeParams.background}
              options={toOpenAiBackgroundOptions(profile.backgroundOptions)}
              disabled={disabled}
              aria-label={messages.playground.background}
              onChange={(value) => onChange({ ...params, background: value })}
            />
          </PlaygroundParamField>
        ) : null}

        {profile.showModeration ? (
          <PlaygroundParamField
            label={messages.playground.moderation}
            htmlFor={`${formId}-moderation`}
          >
            <OptionRadioGroup
              id={`${formId}-moderation`}
              layout="grid"
              value={safeParams.moderation}
              options={toOpenAiModerationOptions(profile.moderationOptions)}
              disabled={disabled}
              aria-label={messages.playground.moderation}
              onChange={(value) => onChange({ ...params, moderation: value })}
            />
          </PlaygroundParamField>
        ) : null}

        {profile.showCount ? (
          <PlaygroundParamSlider
            id={`${formId}-count`}
            label={messages.playground.count}
            min={1}
            max={profile.maxCount}
            step={1}
            value={imageCount}
            disabled={disabled || profile.maxCount <= 1}
            onChange={(next) => onChange({ ...params, count: String(next) })}
          />
        ) : null}

        {profile.showResponseFormat ? (
          <PlaygroundParamField
            label={messages.playground.responseFormat}
            htmlFor={`${formId}-response-format`}
          >
            <OptionRadioGroup
              id={`${formId}-response-format`}
              layout="grid"
              value={safeParams.responseFormat}
              options={[
                { value: "url", label: messages.playground.responseFormatUrl },
                {
                  value: "b64_json",
                  label: messages.playground.responseFormatB64,
                },
              ]}
              disabled={disabled}
              aria-label={messages.playground.responseFormat}
              onChange={(value) =>
                onChange({ ...params, responseFormat: value })
              }
            />
          </PlaygroundParamField>
        ) : null}

        {profile.showAsync ? (
          <PlaygroundParamSwitch
            id={`${formId}-async`}
            label={messages.playground.async}
            checked={safeParams.async}
            disabled={disabled}
            onChange={(checked) => onChange({ ...params, async: checked })}
          />
        ) : null}
      </PlaygroundParamGrid>
    </PlaygroundSettingsShell>
  );
}
