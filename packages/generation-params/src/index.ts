/**
 * Model-aware image / video generation parameter adapters.
 *
 * Public surface:
 * - model family detection (`model-families`)
 * - image profile / sanitize / request body (`image`)
 * - video profile / sanitize / request body (`video`)
 */

export type {
  ImageModelFamily,
  VideoModelFamily,
  ModelIdentity,
  SeedreamVariant,
  SeedreamAspectRatio,
  SeedreamSizeTier,
  OpenAiImageVariant,
} from "./model-families";

export {
  isSeedreamModel,
  resolveSeedreamVariant,
  getSeedreamSizeTiers,
  getSeedreamReferenceLimit,
  SEEDREAM_ASPECT_RATIOS,
  SEEDREAM_TIER_ASPECT_PIXELS,
  resolveSeedreamPixelSize,
  migrateSeedreamPixelSizeToRatio,
  isGeminiImageModel,
  resolveOpenAiImageVariant,
  resolveImageFamily,
  resolveVideoFamily,
  inferLockedImageAspectRatio,
  inferLockedImageAsync,
  inferLockedImageTier,
  migrateOpenAiPixelSizeToRatio,
  OPENAI_GPT_IMAGE_QUALITY_OPTIONS,
  OPENAI_GPT_IMAGE_BACKGROUND_OPTIONS,
  OPENAI_GPT_IMAGE_MODERATION_OPTIONS,
  getOpenAiImageSizes,
  getOpenAiImageMaxCount,
  isMiniMaxH3MaxModel,
  isSeedance20Model,
  isSeedance25Model,
  isSeedance2Model,
  isVideoUltraModel,
  isWan3ImageOnlyModel,
  isWan3VideoModel,
  inferLockedDuration,
  inferLockedResolution,
} from "./model-families";

export type {
  ImagePlaygroundModel,
  PlaygroundImageParams,
  ImageCapabilityProfile,
} from "./image";

export {
  IMAGE_RESPONSE_FORMATS,
  DEFAULT_IMAGE_SIZES,
  GEMINI_IMAGE_SIZES,
  DEFAULT_IMAGE_PARAMS,
  getImageReferenceLimit,
  getImageCapabilityProfile,
  sanitizeImageParams,
  toImagePlaygroundModel,
  buildImageRequestBody,
} from "./image";

export type {
  PlaygroundVideoParams,
  VideoDurationSpec,
  VideoCapabilityProfile,
  ResolvedVideoMediaInput,
} from "./video";

export {
  SEEDANCE_RATIOS,
  SEEDANCE_RESOLUTIONS,
  SEEDANCE_25_RESOLUTIONS,
  MINIMAX_RATIOS,
  MINIMAX_RESOLUTIONS,
  MINIMAX_MAX_RESOLUTIONS,
  MINIMAX_REFERENCE_LIMITS,
  MINIMAX_MAX_REFERENCE_LIMITS,
  KLING_RATIOS,
  KLING_MODES,
  VIDEO_ULTRA_RATIOS,
  WAN3_RATIOS,
  WAN3_RESOLUTIONS,
  GENERIC_RATIOS,
  VIDEO_ULTRA_REFERENCE_LIMITS,
  WAN3_REFERENCE_LIMITS,
  WAN3_IMAGE_ONLY_REFERENCE_LIMITS,
  DEFAULT_VIDEO_PARAMS,
  getVideoReferenceLimits,
  getVideoDurationSpec,
  getVideoCapabilityProfile,
  sanitizeVideoParams,
  resolveVideoReferenceMode,
  resolveVideoSanitizeMediaFlags,
  buildVideoRequestBody,
  splitVideoMediaForApi,
} from "./video";

export type {
  VideoReferenceLimits,
  VideoReferenceMode,
  PlaygroundMediaType,
  PlaygroundMediaReference,
  VideoResolution,
} from "./media-types";

export {
  MAX_FRAME_REFERENCE_IMAGES,
  SEEDANCE_20_REFERENCE_LIMITS,
  SEEDANCE_25_REFERENCE_LIMITS,
  SEEDANCE_LEGACY_REFERENCE_LIMITS,
  VIDEO_RESOLUTIONS,
} from "./media-types";

export {
  PROMPT_MENTION_TOKEN_SOURCE,
  stripPromptMentionTokens,
} from "./prompt-tokens";
