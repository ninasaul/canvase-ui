import type { CanvasFlowNode } from "./canvas-store";
import { getAdminApiBaseUrl } from "@/lib/api";

const EXTENSION_BY_TYPE: Record<string, string> = {
  image: "png",
  video: "mp4",
  audio: "mp3",
};

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
};

function safeFilename(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

function extensionFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    const extension = path.split(".").pop()?.toLowerCase();
    if (extension && /^[a-z0-9]{2,5}$/.test(extension)) {
      return extension;
    }
  } catch {
    // Ignore malformed URLs.
  }
  return null;
}

function triggerDownload(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function extensionForNode(
  node: CanvasFlowNode,
  sourceUrl: string | undefined,
  mimeType: string | undefined,
): string {
  const type = node.type ?? "text";
  return (
    (mimeType ? EXTENSION_BY_MIME[mimeType] : undefined) ??
    (sourceUrl ? extensionFromUrl(sourceUrl) : null) ??
    EXTENSION_BY_TYPE[type] ??
    "bin"
  );
}

async function downloadFromCanvasApi(
  node: CanvasFlowNode,
  canvasId: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      `${getAdminApiBaseUrl()}/portal/v1/canvases/${canvasId}/nodes/${node.id}/download`,
      { credentials: "include" },
    );
    if (!response.ok) {
      return false;
    }
    const blob = await response.blob();
    const sourceUrl = node.data.url?.trim() || node.data.urls?.[0]?.trim();
    const extension = extensionForNode(node, sourceUrl, blob.type);
    const base = safeFilename(
      node.data.label ?? "",
      node.type === "text" ? "text" : (node.type ?? "asset"),
    );
    triggerBlobDownload(blob, `${base}.${extension}`);
    return true;
  } catch {
    return false;
  }
}

/** Download a node's text or media asset, preferring the authenticated API. */
export async function downloadCanvasNode(
  node: CanvasFlowNode,
  canvasId?: string,
): Promise<void> {
  const type = node.type ?? "text";
  const base = safeFilename(
    node.data.label ?? "",
    type === "text" ? "text" : type,
  );

  if (type === "text") {
    const blob = new Blob([node.data.text ?? ""], {
      type: "text/plain;charset=utf-8",
    });
    triggerBlobDownload(blob, `${base}.txt`);
    return;
  }

  if (canvasId && (await downloadFromCanvasApi(node, canvasId))) {
    return;
  }

  const sourceUrl =
    node.data.url?.trim() ||
    node.data.urls?.find((item) => item.trim())?.trim();
  if (!sourceUrl) {
    throw new Error("No asset to download");
  }

  const extension = extensionForNode(node, sourceUrl, undefined);
  const filename = `${base}.${extension}`;

  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }
    const blob = await response.blob();
    triggerBlobDownload(blob, filename);
  } catch {
    // Last resort for external URLs without CORS support.
    triggerDownload(sourceUrl, filename);
  }
}
