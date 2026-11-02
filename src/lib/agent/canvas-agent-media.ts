import type { ChatMediaCapabilityProfile, ChatMediaKind } from "@/lib/playground/chat-capabilities";
import { prisma } from "@/lib/prisma";
import { assertSafeRemoteUrl } from "@/lib/shared/url-safety";
import { getObjectBytes } from "@/lib/storage/s3-client";
import { resolveStorageConfig } from "@/lib/storage/s3-config";

/** Max bytes to inline as data URL for vision image parts. */
export const AGENT_INLINE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
/** Max bytes to inline for video/audio multimodal parts. */
export const AGENT_INLINE_AV_MAX_BYTES = 2 * 1024 * 1024;

export type AgentChatAttachmentInput = {
  url: string;
  kind?: ChatMediaKind;
};

export type ResolvedAgentChatAttachment = {
  url: string;
  kind: ChatMediaKind;
  /** URL used in multimodal content parts (data URL when inlined). */
  modelUrl: string;
  inlined: boolean;
  skipNote?: string;
};

function inlineLimitForKind(kind: ChatMediaKind): number {
  return kind === "image"
    ? AGENT_INLINE_IMAGE_MAX_BYTES
    : AGENT_INLINE_AV_MAX_BYTES;
}

function kindSupported(
  kind: ChatMediaKind,
  profile: ChatMediaCapabilityProfile,
): boolean {
  if (kind === "image") {
    return profile.supportsImages;
  }
  if (kind === "video") {
    return profile.supportsVideos;
  }
  return profile.supportsAudio;
}

function toDataUrl(mimeType: string, bytes: Buffer): string {
  const mime = mimeType.trim() || "application/octet-stream";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

function defaultMimeForKind(kind: ChatMediaKind): string {
  if (kind === "video") {
    return "video/mp4";
  }
  if (kind === "audio") {
    return "audio/mpeg";
  }
  return "image/jpeg";
}

/**
 * Upstream chat providers often cannot fetch private / hotlink-protected CDNs.
 * Prefer data URLs so the model never has to download o.tokenmei.com etc.
 */
async function fetchHttpAsDataUrl(
  url: string,
  kind: ChatMediaKind,
  maxBytes: number,
): Promise<string | null> {
  if (!/^https?:\/\//i.test(url)) {
    return null;
  }
  try {
    // The URL comes from the request body: never let it reach internal hosts,
    // and re-validate every redirect hop.
    let target = await assertSafeRemoteUrl(url);
    let response: Response | null = null;
    for (let hop = 0; hop < 3; hop += 1) {
      response = await fetch(target, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(20_000),
      });
      const location = response.headers.get("location");
      if (response.status < 300 || response.status >= 400 || !location) {
        break;
      }
      target = await assertSafeRemoteUrl(new URL(location, target).toString());
      response = null;
    }
    if (!response || !response.ok) {
      return null;
    }
    const mimeType =
      response.headers.get("content-type")?.split(";")[0]?.trim() ||
      defaultMimeForKind(kind);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) {
      return null;
    }
    return toDataUrl(mimeType, bytes);
  } catch {
    return null;
  }
}

async function resolveOneAttachment(input: {
  ownerId: string;
  attachment: AgentChatAttachmentInput;
  profile: ChatMediaCapabilityProfile;
  storage: NonNullable<Awaited<ReturnType<typeof resolveStorageConfig>>> | null;
}): Promise<ResolvedAgentChatAttachment> {
  const url = input.attachment.url.trim();
  const kind = input.attachment.kind ?? "image";
  const base: ResolvedAgentChatAttachment = {
    url,
    kind,
    modelUrl: url,
    inlined: false,
  };

  if (!url) {
    return base;
  }

  if (!kindSupported(kind, input.profile)) {
    return {
      ...base,
      skipNote: "model cannot understand this media type; URL listed for canvas tools only",
    };
  }

  const limit = inlineLimitForKind(kind);

  if (input.storage) {
    const asset = await prisma.mediaAsset.findFirst({
      where: {
        ownerId: input.ownerId,
        url,
        status: "ready",
      },
      select: {
        objectKey: true,
        mimeType: true,
        sizeBytes: true,
      },
    });

    if (
      asset &&
      !(
        typeof asset.sizeBytes === "number" &&
        asset.sizeBytes > 0 &&
        asset.sizeBytes > limit
      )
    ) {
      const object = await getObjectBytes({
        config: input.storage,
        objectKey: asset.objectKey,
        maxBytes: limit,
      });
      if (object) {
        const mimeType =
          object.contentType ||
          asset.mimeType?.trim() ||
          defaultMimeForKind(kind);
        return {
          url,
          kind,
          modelUrl: toDataUrl(mimeType, object.bytes),
          inlined: true,
        };
      }
    }
  }

  // CDN may block the model provider; fetch on our server and inline.
  const fetched = await fetchHttpAsDataUrl(url, kind, limit);
  if (fetched) {
    return {
      url,
      kind,
      modelUrl: fetched,
      inlined: true,
    };
  }

  return {
    ...base,
    skipNote:
      "could not inline media for the model; public URL kept for canvas tools only",
  };
}

function passthroughAttachments(
  attachments: AgentChatAttachmentInput[],
  skipNote: string,
): ResolvedAgentChatAttachment[] {
  return attachments.map((attachment) => ({
    url: attachment.url.trim(),
    kind: attachment.kind ?? "image",
    modelUrl: attachment.url.trim(),
    inlined: false,
    skipNote,
  }));
}

/**
 * Resolve attachment public URLs into data URLs the upstream model can read
 * without fetching private object storage.
 * Set inline=false for older history turns to avoid re-downloading every request.
 */
export async function resolveAgentChatAttachments(input: {
  ownerId: string;
  attachments: AgentChatAttachmentInput[];
  profile: ChatMediaCapabilityProfile;
  /** When false, keep public URLs only (no S3 fetch). Default true. */
  inline?: boolean;
}): Promise<ResolvedAgentChatAttachment[]> {
  if (input.attachments.length === 0) {
    return [];
  }

  if (input.inline === false) {
    // Do not re-send historical http(s) image_url — providers often fail to download CDN.
    return passthroughAttachments(
      input.attachments,
      "history attachment; URL for canvas tools only (not re-inlined)",
    );
  }

  const storage = await resolveStorageConfig(input.ownerId);

  const resolved: ResolvedAgentChatAttachment[] = [];
  for (const attachment of input.attachments) {
    resolved.push(
      await resolveOneAttachment({
        ownerId: input.ownerId,
        attachment,
        profile: input.profile,
        storage,
      }),
    );
  }
  return resolved;
}
