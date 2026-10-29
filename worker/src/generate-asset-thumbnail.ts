import { spawn } from "node:child_process";
import sharp from "sharp";

import { prisma } from "@/lib/prisma";
import {
  buildThumbnailObjectKey,
  putObjectBytes,
} from "@/lib/storage/s3-client";
import {
  buildPublicObjectUrl,
  resolveStorageConfig,
} from "@/lib/storage/s3-config";

const THUMBNAIL_MAX_EDGE = 480;
const THUMBNAIL_QUALITY = 75;
const VIDEO_TIMEOUT_MS = 45_000;
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;

async function encodeThumbnail(
  input: Buffer,
): Promise<{ bytes: Buffer; width: number; height: number }> {
  const output = await sharp(input, {
    failOn: "error",
    limitInputPixels: 64_000_000,
  })
    .rotate()
    .resize({
      width: THUMBNAIL_MAX_EDGE,
      height: THUMBNAIL_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: THUMBNAIL_QUALITY })
    .toBuffer({ resolveWithObject: true });
  return {
    bytes: output.data,
    width: output.info.width,
    height: output.info.height,
  };
}

async function downloadBinary(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download source (${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_SOURCE_BYTES) {
    throw new Error("Thumbnail source file is too large");
  }
  return buffer;
}

function captureVideoFrame(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.env.FFMPEG_PATH?.trim() || "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        "0.1",
        "-i",
        url,
        "-frames:v",
        "1",
        "-vf",
        "scale=480:-2",
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "pipe:1",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const chunks: Buffer[] = [];
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Video thumbnail timed out"));
    }, VIDEO_TIMEOUT_MS);
    child.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2_000);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
        return;
      }
      reject(
        new Error(
          `Video thumbnail failed${stderr ? `: ${stderr.trim()}` : ""}`,
        ),
      );
    });
  });
}

export async function generateAssetThumbnail(assetId: string): Promise<boolean> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      ownerId: true,
      objectKey: true,
      url: true,
      mimeType: true,
      mediaType: true,
      purpose: true,
      thumbnailUrl: true,
      status: true,
    },
  });
  if (!asset || asset.status !== "ready" || asset.thumbnailUrl) {
    return false;
  }
  if (
    asset.purpose === "canvas_thumbnail" ||
    asset.purpose === "canvas_export"
  ) {
    return false;
  }
  if (asset.mediaType !== "image" && asset.mediaType !== "video") {
    return false;
  }

  let input: Buffer;
  if (asset.mimeType.startsWith("image/") || asset.mediaType === "image") {
    input = await downloadBinary(asset.url);
  } else if (
    asset.mimeType.startsWith("video/") ||
    asset.mediaType === "video"
  ) {
    input = await captureVideoFrame(asset.url);
  } else {
    return false;
  }

  const thumbnail = await encodeThumbnail(input);
  const storage = await resolveStorageConfig(asset.ownerId);
  if (!storage) {
    throw new Error("Object storage is not configured for asset owner");
  }

  const thumbnailObjectKey = buildThumbnailObjectKey(asset.objectKey);
  await putObjectBytes({
    config: storage,
    objectKey: thumbnailObjectKey,
    bytes: thumbnail.bytes,
    contentType: "image/webp",
  });
  const thumbnailUrl = buildPublicObjectUrl(storage, thumbnailObjectKey);

  await prisma.mediaAsset.update({
    where: { id: asset.id },
    data: {
      thumbnailUrl,
      thumbnailObjectKey,
      thumbnailWidth: thumbnail.width,
      thumbnailHeight: thumbnail.height,
    },
  });
  return true;
}
