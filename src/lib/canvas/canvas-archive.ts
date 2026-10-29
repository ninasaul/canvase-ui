import type { CanvasFlowNode } from "./canvas-store";
import { getAdminApiBaseUrl } from "@/lib/api";
import { messages } from "@/messages";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

function safeName(value: string, fallback: string): string {
  const base = value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return base || fallback;
}

function extensionFromUrl(url: string | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    const extension = new URL(url).pathname.split(".").pop()?.toLowerCase();
    return extension && /^[a-z0-9]{2,5}$/.test(extension) ? extension : null;
  } catch {
    return null;
  }
}

function nodeAssetUrl(node: CanvasFlowNode): string | undefined {
  return node.data.url?.trim() || node.data.urls?.find((url) => url.trim())?.trim();
}

function nodeCanDownload(node: CanvasFlowNode): boolean {
  return Boolean(nodeAssetUrl(node) || node.data.assetId);
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function writeU16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function writeU32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(): { time: number; date: number } {
  const now = new Date();
  return {
    time:
      (now.getHours() << 11) |
      (now.getMinutes() << 5) |
      Math.floor(now.getSeconds() / 2),
    date:
      ((Math.max(1980, now.getFullYear()) - 1980) << 9) |
      ((now.getMonth() + 1) << 5) |
      now.getDate(),
  };
}

type ZipEntry = { name: string; bytes: Uint8Array };

export function buildZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime();
  const localParts: BlobPart[] = [];
  const centralParts: BlobPart[] = [];
  let centralSize = 0;
  let offset = 0;
  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.bytes);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    writeU32(localView, 0, 0x04034b50);
    writeU16(localView, 4, 20);
    writeU16(localView, 6, 0x0800);
    writeU16(localView, 8, 0);
    writeU16(localView, 10, time);
    writeU16(localView, 12, date);
    writeU32(localView, 14, crc);
    writeU32(localView, 18, entry.bytes.length);
    writeU32(localView, 22, entry.bytes.length);
    writeU16(localView, 26, nameBytes.length);
    writeU16(localView, 28, 0);
    local.set(nameBytes, 30);
    localParts.push(local.buffer as ArrayBuffer, entry.bytes.buffer as ArrayBuffer);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    writeU32(centralView, 0, 0x02014b50);
    writeU16(centralView, 4, 20);
    writeU16(centralView, 6, 20);
    writeU16(centralView, 8, 0x0800);
    writeU16(centralView, 10, 0);
    writeU16(centralView, 12, time);
    writeU16(centralView, 14, date);
    writeU32(centralView, 16, crc);
    writeU32(centralView, 20, entry.bytes.length);
    writeU32(centralView, 24, entry.bytes.length);
    writeU16(centralView, 28, nameBytes.length);
    writeU16(centralView, 30, 0);
    writeU16(centralView, 32, 0);
    writeU16(centralView, 34, 0);
    writeU16(centralView, 36, 0);
    writeU32(centralView, 38, 0);
    writeU32(centralView, 42, offset);
    central.set(nameBytes, 46);
    centralParts.push(central.buffer as ArrayBuffer);
    centralSize += central.length;
    offset += local.length + entry.bytes.length;
  }
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeU32(endView, 0, 0x06054b50);
  writeU16(endView, 4, 0);
  writeU16(endView, 6, 0);
  writeU16(endView, 8, entries.length);
  writeU16(endView, 10, entries.length);
  writeU32(endView, 12, centralSize);
  writeU32(endView, 16, offset);
  writeU16(endView, 20, 0);
  return new Blob([...localParts, ...centralParts, end], {
    type: "application/zip",
  });
}

export async function downloadCanvasArchive(options: {
  canvasId: string;
  canvasTitle: string;
  nodes: CanvasFlowNode[];
  kind: "image" | "video";
}): Promise<{ downloaded: number; failed: number }> {
  const { canvasId, canvasTitle, kind } = options;
  const selected = options.nodes.filter(
    (node) => node.type === kind && nodeCanDownload(node),
  );
  if (selected.length === 0) {
    return { downloaded: 0, failed: 0 };
  }
  const entries: ZipEntry[] = [];
  const used = new Set<string>();
  let failed = 0;
  for (const node of selected) {
    try {
      const response = await fetch(
        `${getAdminApiBaseUrl()}/portal/v1/canvases/${canvasId}/nodes/${node.id}/download`,
        { credentials: "include" },
      );
      if (!response.ok) {
        throw new Error(
          messages.canvas.archiveDownloadFailed.replace(
            "{label}",
            node.data.label || kind,
          ),
        );
      }
      const blob = await response.blob();
      const sourceUrl = nodeAssetUrl(node);
      const extension =
        EXTENSION_BY_MIME[blob.type.split(";")[0]!.trim()] ??
        extensionFromUrl(sourceUrl) ??
        (kind === "image" ? "png" : "mp4");
      const base = safeName(
        node.data.label ?? "",
        kind === "image" ? "image" : "video",
      );
      let filename = `${base}.${extension}`;
      let counter = 2;
      while (used.has(filename)) {
        filename = `${base}-${counter}.${extension}`;
        counter += 1;
      }
      used.add(filename);
      entries.push({
        name: filename,
        bytes: new Uint8Array(await blob.arrayBuffer()),
      });
    } catch {
      failed += 1;
    }
  }
  if (entries.length === 0) {
    throw new Error(messages.canvas.archiveNoFiles);
  }
  const zipName = `${safeName(canvasTitle, "canvas")}-${
    kind === "image" ? "images" : "videos"
  }.zip`;
  saveBlob(buildZip(entries), zipName);
  return { downloaded: entries.length, failed };
}
