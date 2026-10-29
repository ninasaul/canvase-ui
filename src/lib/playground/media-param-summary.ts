import {
  getImageCapabilityProfile,
  sanitizeImageParams,
  type ImagePlaygroundModel,
  type PlaygroundImageParams,
} from "@canvase/generation-params/image";
import type { ModelIdentity } from "@canvase/generation-params/model-families";
import {
  getVideoCapabilityProfile,
  resolveVideoSanitizeMediaFlags,
  sanitizeVideoParams,
  type PlaygroundVideoParams,
} from "@canvase/generation-params/video";
import { messages } from "@/messages";

export type MediaParamSummarySegment = {
  id: string;
  label: string;
};

function openAiQualityLabel(value: string): string {
  const labels = messages.playground.openAiQualityLabels as Record<
    string,
    string
  >;
  return labels[value] ?? value;
}

export function buildImageParamSummary(
  model: ImagePlaygroundModel,
  params: PlaygroundImageParams,
): MediaParamSummarySegment[] {
  const profile = getImageCapabilityProfile(model);
  const safe = sanitizeImageParams(model, params);
  const segments: MediaParamSummarySegment[] = [
    { id: "size", label: safe.size },
  ];
  if (profile.showAspectRatio && safe.aspectRatio) {
    segments.push({ id: "aspectRatio", label: safe.aspectRatio });
  }
  if (profile.showCount && safe.count !== "1") {
    segments.push({
      id: "count",
      label: messages.playground.paramSummaryCount.replace(
        "{count}",
        safe.count,
      ),
    });
  }
  if (profile.showQuality && safe.quality) {
    segments.push({
      id: "quality",
      label: openAiQualityLabel(safe.quality),
    });
  }
  return segments;
}

export function buildVideoParamSummary(
  model: ModelIdentity,
  params: PlaygroundVideoParams,
  hasReferenceMedia: boolean,
): MediaParamSummarySegment[] {
  const profile = getVideoCapabilityProfile(model);
  const safe = sanitizeVideoParams(
    model,
    params,
    resolveVideoSanitizeMediaFlags(model, params, hasReferenceMedia),
  );
  const segments: MediaParamSummarySegment[] = [
    { id: "ratio", label: safe.ratio },
    { id: "resolution", label: safe.resolution },
    {
      id: "duration",
      label: messages.playground.paramSummaryDuration.replace(
        "{seconds}",
        safe.duration,
      ),
    },
  ];
  if (profile.showKlingMode && safe.klingMode) {
    segments.push({ id: "klingMode", label: safe.klingMode });
  }
  return segments;
}
