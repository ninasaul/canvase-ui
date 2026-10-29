import type {
  PlaygroundMediaReference,
  VideoReferenceLimits,
  VideoReferenceMode,
} from "./media-types";
import {
  MAX_FRAME_REFERENCE_IMAGES,
  SEEDANCE_20_REFERENCE_LIMITS,
  SEEDANCE_25_REFERENCE_LIMITS,
  SEEDANCE_LEGACY_REFERENCE_LIMITS,
  VIDEO_RESOLUTIONS as videoResolutions,
} from "./media-types";
import {
  inferLockedDuration,
  inferLockedResolution,
  isMiniMaxH3MaxModel,
  isSeedance20Model,
  isSeedance25Model,
  isSeedance2Model,
  isVideoUltraModel,
  isWan3ImageOnlyModel,
  isWan3VideoModel,
  resolveVideoFamily,
  type ModelIdentity,
  type VideoModelFamily,
} from "./model-families";
import { stripPromptMentionTokens } from "./prompt-tokens";

export const SEEDANCE_RATIOS = [
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
  "21:9",
  "adaptive",
] as const;

export const SEEDANCE_RESOLUTIONS = ["480p", "720p", "1080p", "4k"] as const;

export const SEEDANCE_25_RESOLUTIONS = ["480p", "720p", "1080p"] as const;

export const MINIMAX_RATIOS = [
  "16:9",
  "4:3",
  "1:1",
  "3:4",
  "9:16",
  "21:9",
  "adaptive",
] as const;

export const MINIMAX_RESOLUTIONS = ["768P", "2K"] as const;

export const MINIMAX_MAX_RESOLUTIONS = ["480P", "768P"] as const;

/** MiniMax H3：首尾帧 + 参考图/视频/音频（与官方 V2 上限对齐）。 */
export const MINIMAX_REFERENCE_LIMITS = {
  frameImages: MAX_FRAME_REFERENCE_IMAGES,
  images: 9,
  videos: 3,
  audio: 3,
} as const;

/** MiniMax H3 Max：仅首尾帧，无参考生。 */
export const MINIMAX_MAX_REFERENCE_LIMITS = {
  frameImages: MAX_FRAME_REFERENCE_IMAGES,
  images: 0,
  videos: 0,
  audio: 0,
} as const;

export const KLING_RATIOS = ["16:9", "9:16", "1:1"] as const;

export const KLING_MODES = ["std", "pro", "4k"] as const;

export const VIDEO_ULTRA_RATIOS = ["16:9", "9:16", "1:1"] as const;

export const WAN3_RATIOS = ["16:9", "9:16", "1:1", "adaptive"] as const;

export const WAN3_RESOLUTIONS = ["1080p", "720p", "480p"] as const;

export const GENERIC_RATIOS = [
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
  "21:9",
  "adaptive",
] as const;

/** xz video-ultra omni-reference caps (docs do not specify; keep conservative). */
export const VIDEO_ULTRA_REFERENCE_LIMITS = {
  frameImages: MAX_FRAME_REFERENCE_IMAGES,
  images: 9,
  videos: 3,
  audio: 3,
} as const;

/** 万相 3.0 official caps (images≤10, videos≤5, audio≤5). */
export const WAN3_REFERENCE_LIMITS = {
  frameImages: MAX_FRAME_REFERENCE_IMAGES,
  images: 10,
  videos: 5,
  audio: 5,
} as const;

export const WAN3_IMAGE_ONLY_REFERENCE_LIMITS = {
  frameImages: MAX_FRAME_REFERENCE_IMAGES,
  images: 10,
  videos: 0,
  audio: 5,
} as const;

export type PlaygroundVideoParams = {
  ratio: string;
  resolution: string;
  duration: string;
  generateAudio: boolean;
  watermark: boolean;
  cameraFixed: boolean;
  draftMode: boolean;
  klingMode: string;
  referenceMode: VideoReferenceMode;
  seed: string;
};

export const DEFAULT_VIDEO_PARAMS: PlaygroundVideoParams = {
  ratio: "16:9",
  resolution: "720p",
  duration: "5",
  generateAudio: false,
  watermark: false,
  cameraFixed: false,
  draftMode: false,
  klingMode: "std",
  referenceMode: "omni",
  seed: "",
};

export type VideoDurationSpec =
  | { type: "range"; min: number; max: number }
  | { type: "enum"; values: readonly number[] };

export type VideoCapabilityProfile = {
  family: VideoModelFamily;
  label: string;
  ratios: readonly string[];
  resolutions: readonly string[];
  duration: VideoDurationSpec;
  showGenerateAudio: boolean;
  showWatermark: boolean;
  showCameraFixed: boolean;
  showDraftMode: boolean;
  showKlingMode: boolean;
  supportsFirstFrame: boolean;
  supportsLastFrame: boolean;
  supportsReferenceImages: boolean;
  supportsReferenceVideos: boolean;
  supportsReferenceAudio: boolean;
  supportsOmniReference: boolean;
  supportsSeed: boolean;
  referenceLimits: VideoReferenceLimits;
  lockedResolution: string | null;
  lockedDuration: number | null;
};

export function getVideoReferenceLimits(
  model: ModelIdentity | string,
): VideoReferenceLimits {
  if (resolveVideoFamily(model) === "minimax-h3") {
    if (isMiniMaxH3MaxModel(model)) {
      return { ...MINIMAX_MAX_REFERENCE_LIMITS };
    }
    return { ...MINIMAX_REFERENCE_LIMITS };
  }
  if (isVideoUltraModel(model)) {
    return { ...VIDEO_ULTRA_REFERENCE_LIMITS };
  }
  if (isWan3ImageOnlyModel(model)) {
    return { ...WAN3_IMAGE_ONLY_REFERENCE_LIMITS };
  }
  if (isWan3VideoModel(model)) {
    return { ...WAN3_REFERENCE_LIMITS };
  }
  if (isSeedance25Model(model)) {
    return { ...SEEDANCE_25_REFERENCE_LIMITS };
  }
  if (isSeedance20Model(model)) {
    return { ...SEEDANCE_20_REFERENCE_LIMITS };
  }
  if (resolveVideoFamily(model) === "seedance") {
    return { ...SEEDANCE_LEGACY_REFERENCE_LIMITS };
  }
  return { ...SEEDANCE_LEGACY_REFERENCE_LIMITS };
}

function seedanceProfileLabel(model: ModelIdentity | string): string {
  if (isSeedance25Model(model)) {
    return "Seedance 2.5";
  }
  if (isSeedance20Model(model)) {
    return "Seedance 2.0";
  }
  return "Seedance";
}

export function getVideoDurationSpec(
  model: ModelIdentity | string,
): VideoDurationSpec {
  const locked = inferLockedDuration(model);
  if (locked !== null) {
    return { type: "enum", values: [locked] };
  }

  const family = resolveVideoFamily(model);
  if (family === "minimax-h3") {
    if (isMiniMaxH3MaxModel(model)) {
      return { type: "range", min: 5, max: 15 };
    }
    return { type: "range", min: 4, max: 15 };
  }
  if (family === "video-ultra") {
    return { type: "range", min: 4, max: 15 };
  }
  if (family === "wan3") {
    // Docs: 2–30s without ref video; with ref video sum ≤30 — keep open range.
    return { type: "range", min: 2, max: 30 };
  }
  if (family === "kling") {
    return { type: "enum", values: [5, 10] };
  }
  if (family === "seedance") {
    // 2.0: 4–15s; 2.5 / legacy: 4–30s
    if (isSeedance20Model(model)) {
      return { type: "range", min: 4, max: 15 };
    }
    return { type: "range", min: 4, max: 30 };
  }
  return { type: "range", min: 1, max: 30 };
}

function videoReferenceCapabilities(
  model: ModelIdentity | string,
  family: VideoModelFamily,
): Pick<
  VideoCapabilityProfile,
  | "supportsFirstFrame"
  | "supportsLastFrame"
  | "supportsReferenceImages"
  | "supportsReferenceVideos"
  | "supportsReferenceAudio"
  | "supportsOmniReference"
  | "supportsSeed"
  | "referenceLimits"
> {
  // Seedance：默认开放全能参考 UI，是否受理交给上游；勿按 2.0/2.5 锁死首尾帧。
  const omni =
    family === "seedance" ||
    family === "video-ultra" ||
    (family === "wan3" && !isWan3ImageOnlyModel(model));
  const wanImageOnly = family === "wan3" && isWan3ImageOnlyModel(model);
  return {
    supportsFirstFrame: true,
    supportsLastFrame: true,
    supportsReferenceImages: true,
    supportsReferenceVideos: omni && !wanImageOnly,
    supportsReferenceAudio: omni || wanImageOnly,
    supportsOmniReference: omni || wanImageOnly,
    supportsSeed: family === "seedance" || family === "wan3",
    referenceLimits: getVideoReferenceLimits(model),
  };
}

export function getVideoCapabilityProfile(
  model: ModelIdentity | string,
): VideoCapabilityProfile {
  const family = resolveVideoFamily(model);
  const duration = getVideoDurationSpec(model);
  const lockedResolution = inferLockedResolution(model);
  const lockedDuration = inferLockedDuration(model);

  const seedanceResolutions = isSeedance25Model(model)
    ? SEEDANCE_25_RESOLUTIONS
    : SEEDANCE_RESOLUTIONS;
  const defaultResolutions =
    family === "seedance"
      ? seedanceResolutions
      : family === "minimax-h3"
        ? isMiniMaxH3MaxModel(model)
          ? MINIMAX_MAX_RESOLUTIONS
          : MINIMAX_RESOLUTIONS
        : family === "kling"
          ? videoResolutions
          : family === "wan3"
            ? WAN3_RESOLUTIONS
            : videoResolutions;
  const resolutions = lockedResolution
    ? [lockedResolution]
    : defaultResolutions;

  const base = {
    duration,
    lockedResolution,
    lockedDuration,
  };

  switch (family) {
    case "seedance":
      return {
        family,
        label: seedanceProfileLabel(model),
        ratios: SEEDANCE_RATIOS,
        resolutions,
        ...base,
        showGenerateAudio: true,
        showWatermark: true,
        showCameraFixed: true,
        showDraftMode: !isSeedance2Model(model),
        showKlingMode: false,
        ...videoReferenceCapabilities(model, family),
      };
    case "minimax-h3": {
      const isMax = isMiniMaxH3MaxModel(model);
      return {
        family,
        label: isMax ? "MiniMax H3 Max" : "MiniMax H3",
        ratios: MINIMAX_RATIOS,
        resolutions,
        ...base,
        showGenerateAudio: false,
        showWatermark: false,
        showCameraFixed: false,
        showDraftMode: false,
        showKlingMode: false,
        supportsFirstFrame: true,
        supportsLastFrame: true,
        supportsReferenceImages: !isMax,
        supportsReferenceVideos: !isMax,
        supportsReferenceAudio: !isMax,
        supportsOmniReference: !isMax,
        supportsSeed: false,
        referenceLimits: getVideoReferenceLimits(model),
      };
    }
    case "kling":
      return {
        family,
        label: "Kling",
        ratios: KLING_RATIOS,
        resolutions,
        ...base,
        showGenerateAudio: false,
        showWatermark: false,
        showCameraFixed: false,
        showDraftMode: false,
        showKlingMode: true,
        supportsFirstFrame: true,
        supportsLastFrame: false,
        supportsReferenceImages: true,
        supportsReferenceVideos: false,
        supportsReferenceAudio: false,
        supportsOmniReference: false,
        supportsSeed: false,
        referenceLimits: getVideoReferenceLimits(model),
      };
    case "video-ultra":
      return {
        family,
        label: "Video Ultra",
        ratios: VIDEO_ULTRA_RATIOS,
        resolutions,
        ...base,
        showGenerateAudio: false,
        showWatermark: false,
        showCameraFixed: false,
        showDraftMode: false,
        showKlingMode: false,
        ...videoReferenceCapabilities(model, family),
      };
    case "wan3":
      return {
        family,
        label: isWan3ImageOnlyModel(model) ? "Wan3 Image" : "Wan3",
        ratios: WAN3_RATIOS,
        resolutions,
        ...base,
        showGenerateAudio: true,
        showWatermark: true,
        showCameraFixed: false,
        showDraftMode: false,
        showKlingMode: false,
        ...videoReferenceCapabilities(model, family),
      };
    default:
      return {
        family: "generic",
        label: "Generic",
        ratios: GENERIC_RATIOS,
        resolutions,
        ...base,
        showGenerateAudio: true,
        showWatermark: true,
        showCameraFixed: false,
        showDraftMode: false,
        showKlingMode: false,
        ...videoReferenceCapabilities(model, family),
      };
  }
}

function pickAllowed(value: string, allowed: readonly string[], fallback: string) {
  return allowed.includes(value) ? value : fallback;
}

function clampDuration(value: number, spec: VideoDurationSpec): number {
  if (spec.type === "enum") {
    const first = spec.values[0] ?? 5;
    return spec.values.includes(value) ? value : first;
  }
  return Math.min(spec.max, Math.max(spec.min, Math.round(value)));
}

export function sanitizeVideoParams(
  model: ModelIdentity | string,
  params: PlaygroundVideoParams,
  options: {
    hasReferenceImage?: boolean;
    hasFrameImage?: boolean;
  } = {},
): PlaygroundVideoParams {
  const profile = getVideoCapabilityProfile(model);
  const durationValue = clampDuration(
    Number.parseInt(params.duration, 10) || 5,
    profile.duration,
  );

  const hasFrameImage = options.hasFrameImage ?? false;
  const hasRef = options.hasReferenceImage ?? false;

  let ratio = params.ratio;
  if (profile.family === "minimax-h3") {
    if (hasFrameImage) {
      ratio = "adaptive";
    } else if (!hasRef && (ratio === "adaptive" || !ratio)) {
      ratio = "16:9";
    } else if (hasRef && !ratio) {
      ratio = "adaptive";
    }
  }

  let resolution = params.resolution;
  if (profile.lockedResolution) {
    resolution = profile.lockedResolution;
  } else if (profile.family === "minimax-h3") {
    resolution = mapMinimaxResolutionForApi(
      params.resolution,
      isMiniMaxH3MaxModel(model),
    );
  }

  let klingMode = params.klingMode;
  if (profile.family === "kling" && profile.lockedResolution === "4k") {
    klingMode = "4k";
  }

  const referenceMode = resolveVideoReferenceMode(profile, params.referenceMode);

  return {
    ...params,
    ratio: pickAllowed(ratio, profile.ratios, profile.ratios[0] ?? "16:9"),
    resolution: pickAllowed(
      resolution,
      profile.resolutions,
      String(profile.resolutions[0] ?? "720p"),
    ),
    duration: String(durationValue),
    klingMode: pickAllowed(klingMode, KLING_MODES, "std"),
    referenceMode,
    seed: profile.supportsSeed ? params.seed.trim() : "",
  };
}

/** Effective reference UX/API mode for a video capability profile. */
export function resolveVideoReferenceMode(
  profile: Pick<
    VideoCapabilityProfile,
    | "supportsOmniReference"
    | "supportsFirstFrame"
    | "supportsLastFrame"
    | "supportsReferenceImages"
  >,
  requested: VideoReferenceMode,
): VideoReferenceMode {
  if (profile.supportsOmniReference && requested === "omni") {
    return "omni";
  }
  // Reference-only stacks without first/last frame roles.
  if (
    !profile.supportsFirstFrame &&
    !profile.supportsLastFrame &&
    profile.supportsReferenceImages
  ) {
    return "omni";
  }
  return "frame";
}

/** Options for sanitizeVideoParams when MiniMax frame mode locks ratio to adaptive. */
export function resolveVideoSanitizeMediaFlags(
  model: ModelIdentity | string,
  params: Pick<PlaygroundVideoParams, "referenceMode">,
  hasReferenceMedia: boolean,
): { hasReferenceImage: boolean; hasFrameImage: boolean } {
  const profile = getVideoCapabilityProfile(model);
  const mode = resolveVideoReferenceMode(profile, params.referenceMode);
  return {
    hasReferenceImage: hasReferenceMedia,
    hasFrameImage:
      profile.family === "minimax-h3" && mode === "frame" && hasReferenceMedia,
  };
}

function mapMinimaxResolutionForApi(
  resolution: string,
  isMax = false,
): string {
  const upper = resolution.toUpperCase();
  if (isMax) {
    if (upper === "480P" || upper === "768P") {
      return upper;
    }
    const lower = resolution.toLowerCase();
    if (lower === "480p" || lower === "480") {
      return "480P";
    }
    return "768P";
  }
  if (upper === "768P" || upper === "2K") {
    return upper;
  }
  const lower = resolution.toLowerCase();
  if (lower === "480p" || lower === "720p") {
    return "768P";
  }
  if (lower === "1080p" || lower === "4k") {
    return "2K";
  }
  return resolution;
}

export function buildVideoRequestBody(
  model: ModelIdentity | string,
  params: PlaygroundVideoParams,
  input: {
    modelId: string;
    prompt: string;
    firstFrame?: string;
    lastFrame?: string;
    referenceImages?: string[];
    referenceVideos?: string[];
    referenceAudio?: string[];
  },
): Record<string, unknown> {
  const hasFrame = Boolean(input.firstFrame || input.lastFrame);
  const hasRef = Boolean(
    (input.referenceImages?.length ?? 0) > 0 ||
      (input.referenceVideos?.length ?? 0) > 0 ||
      (input.referenceAudio?.length ?? 0) > 0,
  );
  const sanitized = sanitizeVideoParams(model, params, {
    hasReferenceImage: hasFrame || hasRef,
    hasFrameImage: hasFrame,
  });
  const profile = getVideoCapabilityProfile(model);

  const body: Record<string, unknown> = {
    model: input.modelId,
    prompt: stripPromptMentionTokens(input.prompt),
    duration: Number.parseInt(sanitized.duration, 10) || 5,
    ratio: sanitized.ratio,
  };

  if (profile.family === "minimax-h3") {
    body.resolution = mapMinimaxResolutionForApi(
      sanitized.resolution,
      isMiniMaxH3MaxModel(model),
    );
  } else if (profile.family === "kling") {
    body.resolution = sanitized.klingMode;
  } else {
    body.resolution = sanitized.resolution;
  }

  if (sanitized.generateAudio && profile.showGenerateAudio) {
    body.generate_audio = true;
  }
  if (sanitized.watermark && profile.showWatermark) {
    body.watermark = true;
  }
  if (sanitized.cameraFixed && profile.showCameraFixed) {
    body.camera_fixed = true;
  }
  if (sanitized.draftMode && profile.showDraftMode) {
    body.draft = true;
  }

  if (input.firstFrame) {
    body.first_frame = input.firstFrame;
  }
  if (input.lastFrame) {
    body.last_frame = input.lastFrame;
  }
  if (input.referenceImages && input.referenceImages.length > 0) {
    body.reference_images = input.referenceImages;
  }
  if (input.referenceVideos && input.referenceVideos.length > 0) {
    body.reference_videos = input.referenceVideos;
  }
  if (input.referenceAudio && input.referenceAudio.length > 0) {
    body.reference_audio = input.referenceAudio;
  }

  if (profile.family === "video-ultra") {
    body.reference_mode = sanitized.referenceMode;
  }

  const seedValue = Number.parseInt(sanitized.seed, 10);
  if (profile.supportsSeed && Number.isFinite(seedValue)) {
    body.seed = seedValue;
  }

  return body;
}

export type ResolvedVideoMediaInput = {
  firstFrame?: string;
  lastFrame?: string;
  referenceImages?: string[];
  referenceVideos?: string[];
  referenceAudio?: string[];
};

export function splitVideoMediaForApi(
  resolved: Array<{ mediaType: PlaygroundMediaReference["mediaType"]; url: string }>,
  mode: VideoReferenceMode,
): ResolvedVideoMediaInput {
  if (mode === "frame") {
    const images = resolved.filter((item) => item.mediaType === "image");
    return {
      firstFrame: images[0]?.url,
      lastFrame: images[1]?.url,
    };
  }

  const referenceImages = resolved
    .filter((item) => item.mediaType === "image")
    .map((item) => item.url);
  const referenceVideos = resolved
    .filter((item) => item.mediaType === "video")
    .map((item) => item.url);
  const referenceAudio = resolved
    .filter((item) => item.mediaType === "audio")
    .map((item) => item.url);

  return {
    referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
    referenceVideos: referenceVideos.length > 0 ? referenceVideos : undefined,
    referenceAudio: referenceAudio.length > 0 ? referenceAudio : undefined,
  };
}
