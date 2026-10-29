import { ApiRequestError, getAdminApiBaseUrl } from "@/lib/api";
import { messages } from "@/messages";

const MAX_REFERENCE_BYTES = 50 * 1024 * 1024;

export type PlaygroundUploadErrorCode =
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_TYPE"
  | "TRANSFER_FAILED"
  | "AUTH_REQUIRED"
  | "UPLOAD_FAILED";

const PLAYGROUND_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

const PLAYGROUND_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const PLAYGROUND_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
]);

export const PLAYGROUND_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
export const PLAYGROUND_VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime";
export const PLAYGROUND_AUDIO_ACCEPT = "audio/mpeg,audio/mp3,audio/wav,audio/mp4,audio/x-m4a";
export const PLAYGROUND_CHAT_MEDIA_ACCEPT = [
  PLAYGROUND_IMAGE_ACCEPT,
  PLAYGROUND_VIDEO_ACCEPT,
  PLAYGROUND_AUDIO_ACCEPT,
].join(",");

export type PlaygroundUploadKind = "image" | "video" | "audio";

export function playgroundMediaKindFromMime(
  mimeType: string,
): PlaygroundUploadKind | null {
  const mime = (mimeType.split(";")[0] ?? "").trim().toLowerCase();
  if (!mime) {
    return null;
  }
  if (PLAYGROUND_IMAGE_TYPES.has(mime)) {
    return "image";
  }
  if (PLAYGROUND_VIDEO_TYPES.has(mime)) {
    return "video";
  }
  if (PLAYGROUND_AUDIO_TYPES.has(mime)) {
    return "audio";
  }
  return null;
}

export async function fileToDataUrl(file: File): Promise<string> {
  if (file.size > MAX_REFERENCE_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("READ_FAILED"));
      }
    };
    reader.onerror = () => reject(new Error("READ_FAILED"));
    reader.readAsDataURL(file);
  });
}

function assertPlaygroundMediaFile(
  file: File,
  allowedKinds?: readonly PlaygroundUploadKind[],
): PlaygroundUploadKind {
  if (file.size > MAX_REFERENCE_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }
  const mime = (file.type || "").split(";")[0]?.trim().toLowerCase() ?? "";
  const kind = playgroundMediaKindFromMime(mime);
  if (!kind) {
    throw new Error("UNSUPPORTED_TYPE");
  }
  if (allowedKinds && allowedKinds.length > 0 && !allowedKinds.includes(kind)) {
    throw new Error("UNSUPPORTED_TYPE");
  }
  return kind;
}

/** Normalize upload failures into stable error codes for toast mapping. */
export function mapPlaygroundUploadError(caught: unknown): Error {
  if (
    caught instanceof Error &&
    (caught.message === "FILE_TOO_LARGE" ||
      caught.message === "UNSUPPORTED_TYPE" ||
      caught.message === "TRANSFER_FAILED" ||
      caught.message === "AUTH_REQUIRED" ||
      caught.message === "UPLOAD_FAILED" ||
      caught.name === "AbortError")
  ) {
    return caught;
  }
  if (caught instanceof Error && /^UPLOAD_FAILED/.test(caught.message)) {
    return caught;
  }
  if (caught instanceof ApiRequestError) {
    if (caught.status === 401 || /未登录|Unauthorized/i.test(caught.message)) {
      return new Error("AUTH_REQUIRED");
    }
    if (
      /storage is not configured|对象存储|S3_\*|Storage|placeholder|S3 endpoint|Cannot reach S3/i.test(
        caught.message,
      )
    ) {
      return new Error(caught.message);
    }
    if (/\d+\s*MB|过大/i.test(caught.message)) {
      return new Error("FILE_TOO_LARGE");
    }
    if (/仅支持|PNG|JPEG|WebP|GIF|MP4|WebM|MP3|WAV|类型|视频|音频/i.test(caught.message)) {
      return new Error("UNSUPPORTED_TYPE");
    }
    if (caught.status === 502 || /转存失败/i.test(caught.message)) {
      return new Error("TRANSFER_FAILED");
    }
    return new Error(caught.message || "UPLOAD_FAILED");
  }
  return new Error("UPLOAD_FAILED");
}

/** Toast copy for playground reference / library uploads. */
export function playgroundLibraryUploadToastMessage(caught: unknown): string {
  const code =
    caught instanceof Error ? (caught.message as PlaygroundUploadErrorCode | string) : "";
  if (code === "FILE_TOO_LARGE") {
    return messages.playground.referenceTooLarge;
  }
  if (code === "UNSUPPORTED_TYPE") {
    return messages.playground.mediaLibraryUnsupportedType;
  }
  if (code === "TRANSFER_FAILED") {
    return messages.playground.mediaLibraryTransferFailed;
  }
  if (code === "AUTH_REQUIRED") {
    return messages.playground.mediaLibraryAuthRequired;
  }
  if (
    typeof code === "string" &&
    code &&
    code !== "UPLOAD_FAILED" &&
    (/storage is not configured|对象存储|S3_\*|Storage|placeholder|S3 endpoint|Cannot reach S3|CORS|UPLOAD_FAILED \(/i.test(
      code,
    ) ||
      /^UPLOAD_FAILED/.test(code))
  ) {
    return code;
  }
  return messages.playground.mediaLibraryUploadFailed;
}

/** Toast copy for playground chat multimodal attachments. */
export function playgroundChatUploadToastMessage(caught: unknown): string {
  const code =
    caught instanceof Error ? (caught.message as PlaygroundUploadErrorCode | string) : "";
  if (code === "FILE_TOO_LARGE") {
    return messages.playground.chatAttachmentTooLarge;
  }
  if (code === "UNSUPPORTED_TYPE") {
    return messages.playground.chatAttachmentUnsupportedType;
  }
  if (code === "TRANSFER_FAILED") {
    return messages.playground.mediaLibraryTransferFailed;
  }
  if (code === "AUTH_REQUIRED") {
    return messages.playground.mediaLibraryAuthRequired;
  }
  if (code === "UPLOAD_FAILED") {
    return messages.playground.chatAttachmentUploadFailed;
  }
  if (caught instanceof Error && caught.message.trim()) {
    return caught.message;
  }
  return messages.playground.requestFailed;
}

/** Last path segment of a stored public URL, decoded. */
export function fileNameFromStoredUrl(url: string, fallback = "file"): string {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop();
    if (!last) {
      return fallback;
    }
    return decodeURIComponent(last);
  } catch {
    return fallback;
  }
}

type UploadOptions = {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
  /** Restrict upload MIME kinds. Default: image only (image-gen refs). */
  allowedKinds?: readonly PlaygroundUploadKind[];
  /** Stored library display name / original filename field. */
  filename?: string;
  purpose?:
    | "playground_upload"
    | "generation_output"
    | "transfer_input"
    | "canvas_thumbnail";
};

/**
 * Upload media via S3/R2-compatible presigned PUT (progress via XHR).
 * Metadata is recorded in the local media library after complete.
 */
export type UploadedPlaygroundAsset = {
  url: string;
  assetId: string;
};

type PresignResponse = {
  assetId: string;
  key: string;
  uploadUrl: string;
  publicUrl: string;
  headers?: Record<string, string>;
};

type CompleteResponse = {
  id: string;
  url: string;
  assetId: string;
};

export async function uploadPlaygroundAssetWithMeta(
  file: File,
  options: UploadOptions = {},
): Promise<UploadedPlaygroundAsset> {
  const kind = assertPlaygroundMediaFile(
    file,
    options.allowedKinds ?? ["image"],
  );
  const filename = options.filename?.trim() || file.name?.trim() || kind;
  const mimeType =
    (file.type || "").split(";")[0]?.trim().toLowerCase() ||
    "application/octet-stream";

  try {
    options.onProgress?.(0);
    const presign = await postJson<PresignResponse>(
      "/api/assets/presign",
      {
        filename,
        mimeType,
        sizeBytes: file.size,
        mediaType: kind,
        purpose: options.purpose ?? "playground_upload",
      },
      options.signal,
    );

    await putFileToPresignedUrl({
      uploadUrl: presign.uploadUrl,
      file,
      contentType: mimeType,
      headers: presign.headers,
      signal: options.signal,
      onProgress: options.onProgress,
    });

    const completed = await postJson<CompleteResponse>(
      "/api/assets/complete",
      { assetId: presign.assetId },
      options.signal,
    );

    options.onProgress?.(100);
    const url = completed.url?.trim() || presign.publicUrl?.trim();
    if (!url) {
      throw new Error("UPLOAD_FAILED");
    }
    return {
      url,
      assetId: completed.assetId?.trim() || completed.id || presign.assetId,
    };
  } catch (caught) {
    throw mapPlaygroundUploadError(caught);
  }
}

export async function uploadPlaygroundAsset(
  file: File,
  options: UploadOptions = {},
): Promise<string> {
  const uploaded = await uploadPlaygroundAssetWithMeta(file, options);
  return uploaded.url;
}

async function postJson<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${getAdminApiBaseUrl()}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const payload = (await response.json().catch(() => null)) as
    | (T & { message?: string | string[]; error?: string })
    | null;
  if (!response.ok) {
    const message = Array.isArray(payload?.message)
      ? payload.message.join("；")
      : typeof payload?.message === "string"
        ? payload.message
        : typeof payload?.error === "string"
          ? payload.error
          : messages.requestFailed;
    throw new ApiRequestError(message, response.status);
  }
  return payload as T;
}

function putFileToPresignedUrl(input: {
  uploadUrl: string;
  file: File;
  contentType: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", input.uploadUrl);

    const onAbort = () => {
      xhr.abort();
    };
    input.signal?.addEventListener("abort", onAbort, { once: true });

    xhr.setRequestHeader("Content-Type", input.contentType);
    if (input.headers) {
      for (const [key, value] of Object.entries(input.headers)) {
        if (key.toLowerCase() === "content-type") {
          continue;
        }
        xhr.setRequestHeader(key, value);
      }
    }

    xhr.upload.onprogress = (event) => {
      if (!input.onProgress) {
        return;
      }
      if (event.lengthComputable && event.total > 0) {
        // Leave headroom for the complete call.
        input.onProgress(
          Math.min(95, Math.round((event.loaded / event.total) * 95)),
        );
      }
    };

    xhr.onload = () => {
      input.signal?.removeEventListener("abort", onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      const detail = (xhr.responseText || "").trim().slice(0, 180);
      reject(
        new Error(
          detail
            ? `UPLOAD_FAILED (${xhr.status}): ${detail}`
            : `UPLOAD_FAILED (${xhr.status})`,
        ),
      );
    };

    xhr.onerror = () => {
      input.signal?.removeEventListener("abort", onAbort);
      reject(
        new Error(
          "UPLOAD_FAILED (network). Check bucket CORS allows PUT from this origin.",
        ),
      );
    };

    xhr.onabort = () => {
      input.signal?.removeEventListener("abort", onAbort);
      const error = new Error("Upload aborted");
      error.name = "AbortError";
      reject(error);
    };

    xhr.send(input.file);
  });
}

export function parseReferenceUrls(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function joinReferenceUrls(urls: string[]): string {
  return urls.join("\n");
}
