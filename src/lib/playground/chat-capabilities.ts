export type ChatMediaKind = "image" | "video" | "audio";

export type ChatMediaCapabilityProfile = {
  /** Model can take vision `image_url` parts. */
  supportsImages: boolean;
  /** Model can take chat `video_url` parts. */
  supportsVideos: boolean;
  /** Model can take chat `audio_url` / `input_audio` parts. */
  supportsAudio: boolean;
  maxAttachments: number;
  accept: string;
  kinds: readonly ChatMediaKind[];
};

const DEFAULT_MAX_ATTACHMENTS = 4;

function haystack(modelId: string, vendor?: string | null): string {
  return [modelId, vendor].filter(Boolean).join(" ").toLowerCase();
}

function isImageGenerationOnly(normalized: string): boolean {
  return /flash-image|pro-image|image-preview|imagen|banana|nano-?banana|seedream|dall-?e|gpt-image|flux|midjourney|stable-diffusion/.test(
    normalized,
  );
}

/**
 * Vision / VL chat models (images in messages).
 * Policy: enable images for known vision families / VL variants only.
 * Text-only DeepSeek / Kimi / GLM chat ids stay closed unless marked vl/v/vision.
 */
export function modelSupportsChatImages(
  modelId: string,
  vendor?: string | null,
): boolean {
  const normalized = haystack(modelId, vendor);
  if (!normalized || isImageGenerationOnly(normalized)) {
    return false;
  }
  if (
    /gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-5|o[1-4](?!\w)|chatgpt|claude|sonnet|opus|haiku|gemini|gemma|qwen.*vl|qwen2\.?5?-?vl|qwen3-?vl|qvq|internvl|step-1v|pixtral|llava|idefics|phi-4|mistral-small|mistral-medium|nova|yi-vl|\bvl\b|vision/.test(
      normalized,
    )
  ) {
    return true;
  }
  // DeepSeek: VL + flash / vision chat ids that accept OpenAI image_url parts.
  // deepseek-chat / deepseek-reasoner stay text-only unless tagged vl/vision/flash.
  if (
    /deepseek-?vl|deepseek.*\bvl\b|deepseek.*vision|deepseek-?flash|deepseek.*\bflash\b/.test(
      normalized,
    )
  ) {
    return true;
  }
  // Kimi / Moonshot: VL or vision-tagged ids only.
  if (
    /kimi-?vl|kimi.*\bvl\b|moonshot.*\bvl\b|moonshot.*vision|kimi.*vision/.test(
      normalized,
    )
  ) {
    return true;
  }
  // GLM / ChatGLM: glm-4v, glm-4.5v, glm-*vl, etc. (not plain glm-4 / glm-4-flash).
  if (
    /glm[-\d.]*v\b|glm.*\bvl\b|chatglm[-\d.]*v\b|chatglm.*\bvl\b/.test(
      normalized,
    )
  ) {
    return true;
  }
  // Unknown chat models: assume they accept images. New families (gpt-6-*,
  // kimi-k3, deepseek-v4-*, custom gateway aliases) appear faster than this
  // list; treating them as text-only silently dropped every attachment. When
  // an upstream really cannot take images the agent retries without media.
  return true;
}

/** Models that accept short video clips in chat (Gemini / omni / some VL). */
export function modelSupportsChatVideos(
  modelId: string,
  vendor?: string | null,
): boolean {
  const normalized = haystack(modelId, vendor);
  if (!normalized || isImageGenerationOnly(normalized)) {
    return false;
  }
  return /gemini|gemma|\bomni\b|qwen2\.?5?-?vl|qwen3-?vl|qvq/.test(normalized);
}

/** Models that accept audio clips in chat. */
export function modelSupportsChatAudio(
  modelId: string,
  vendor?: string | null,
): boolean {
  const normalized = haystack(modelId, vendor);
  if (!normalized || isImageGenerationOnly(normalized)) {
    return false;
  }
  return (
    /gpt-4o-audio|gpt-4o-mini-audio|\baudio\b|\bomni\b|gemini|gemma/.test(
      normalized,
    ) || /realtime/.test(normalized)
  );
}

export function getChatMediaAccept(kinds: readonly ChatMediaKind[]): string {
  const parts: string[] = [];
  if (kinds.includes("image")) {
    parts.push("image/png", "image/jpeg", "image/webp", "image/gif");
  }
  if (kinds.includes("video")) {
    parts.push("video/mp4", "video/webm", "video/quicktime");
  }
  if (kinds.includes("audio")) {
    parts.push("audio/mpeg", "audio/mp3", "audio/wav", "audio/mp4", "audio/x-m4a");
  }
  return parts.join(",");
}

export function inferChatMediaKind(mimeType: string): ChatMediaKind | null {
  const mime = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (mime.startsWith("image/")) {
    return "image";
  }
  if (mime.startsWith("video/")) {
    return "video";
  }
  if (mime.startsWith("audio/")) {
    return "audio";
  }
  return null;
}

export function getChatMediaCapabilityProfile(
  modelId: string,
  vendor?: string | null,
): ChatMediaCapabilityProfile {
  const supportsImages = modelSupportsChatImages(modelId, vendor);
  const supportsVideos = modelSupportsChatVideos(modelId, vendor);
  const supportsAudio = modelSupportsChatAudio(modelId, vendor);
  const kinds: ChatMediaKind[] = [];
  if (supportsImages) {
    kinds.push("image");
  }
  if (supportsVideos) {
    kinds.push("video");
  }
  if (supportsAudio) {
    kinds.push("audio");
  }
  return {
    supportsImages,
    supportsVideos,
    supportsAudio,
    maxAttachments: DEFAULT_MAX_ATTACHMENTS,
    accept: getChatMediaAccept(kinds),
    kinds,
  };
}

export function chatMediaCapabilitySummary(
  profile: ChatMediaCapabilityProfile,
): "text" | "image" | "image+video" | "image+audio" | "image+video+audio" | "video" | "audio" | "video+audio" {
  const { supportsImages, supportsVideos, supportsAudio } = profile;
  if (supportsImages && supportsVideos && supportsAudio) {
    return "image+video+audio";
  }
  if (supportsImages && supportsVideos) {
    return "image+video";
  }
  if (supportsImages && supportsAudio) {
    return "image+audio";
  }
  if (supportsVideos && supportsAudio) {
    return "video+audio";
  }
  if (supportsImages) {
    return "image";
  }
  if (supportsVideos) {
    return "video";
  }
  if (supportsAudio) {
    return "audio";
  }
  return "text";
}
