import {
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ResolvedStorageConfig } from "@/lib/storage/s3-config";
import { assertUsableStorageEndpoint } from "@/lib/storage/s3-config";

export function createS3Client(config: ResolvedStorageConfig): S3Client {
  assertUsableStorageEndpoint(config.endpoint);
  return new S3Client({
    region: config.region || "auto",
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function formatStorageError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Object storage request failed";
  }
  const message = error.message || "Object storage request failed";
  if (
    /EPROTO|handshake|ENOTFOUND|ECONNREFUSED|fetch failed|getaddrinfo/i.test(
      message,
    )
  ) {
    return `Cannot reach S3 endpoint (${message}). Check S3_ENDPOINT / CORS / network.`;
  }
  if (/AccessDenied|InvalidAccessKeyId|SignatureDoesNotMatch/i.test(message)) {
    return `Object storage credentials rejected (${message})`;
  }
  if (/NoSuchBucket|Not Found/i.test(message)) {
    return `Bucket not found (${message})`;
  }
  return message;
}

export async function createPresignedPutUrl(input: {
  config: ResolvedStorageConfig;
  objectKey: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<string> {
  try {
    const client = createS3Client(input.config);
    const command = new PutObjectCommand({
      Bucket: input.config.bucket,
      Key: input.objectKey,
      ContentType: input.contentType,
    });
    return await getSignedUrl(client, command, {
      expiresIn: input.expiresInSeconds ?? 60 * 15,
    });
  } catch (error) {
    throw new Error(formatStorageError(error));
  }
}

async function putHeadDeleteProbe(
  client: S3Client,
  bucket: string,
): Promise<void> {
  const probeKey = `__canvase_probe/${Date.now()}.txt`;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: probeKey,
      Body: Buffer.from("canvase-storage-probe"),
      ContentType: "text/plain",
    }),
  );
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: probeKey,
      }),
    );
  } finally {
    await client
      .send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: probeKey,
        }),
      )
      .catch(() => undefined);
  }
}

/**
 * Verifies credentials + bucket reachability with HeadBucket, then a tiny
 * put/head/delete round-trip (covers tokens that cannot HeadBucket alone).
 */
export async function testStorageConnection(
  config: ResolvedStorageConfig,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    assertUsableStorageEndpoint(config.endpoint);
    const client = createS3Client(config);
    let headBucketError: unknown = null;
    try {
      await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    } catch (error) {
      headBucketError = error;
    }

    try {
      await putHeadDeleteProbe(client, config.bucket);
      return { ok: true };
    } catch (probeError) {
      return {
        ok: false,
        message: formatStorageError(headBucketError ?? probeError),
      };
    }
  } catch (error) {
    return { ok: false, message: formatStorageError(error) };
  }
}

export async function headObjectExists(input: {
  config: ResolvedStorageConfig;
  objectKey: string;
}): Promise<boolean> {
  const client = createS3Client(input.config);
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: input.config.bucket,
        Key: input.objectKey,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export async function deleteObject(input: {
  config: ResolvedStorageConfig;
  objectKey: string;
}): Promise<void> {
  const client = createS3Client(input.config);
  await client.send(
    new DeleteObjectCommand({
      Bucket: input.config.bucket,
      Key: input.objectKey,
    }),
  );
}

export async function putObjectBytes(input: {
  config: ResolvedStorageConfig;
  objectKey: string;
  bytes: Buffer;
  contentType: string;
}): Promise<void> {
  try {
    const client = createS3Client(input.config);
    await client.send(
      new PutObjectCommand({
        Bucket: input.config.bucket,
        Key: input.objectKey,
        Body: input.bytes,
        ContentType: input.contentType,
      }),
    );
  } catch (error) {
    throw new Error(formatStorageError(error));
  }
}

/**
 * Sibling key for generated thumbnails.
 * `user/2026/10/{assetId}-file.png` → `user/2026/10/{assetId}-thumbnail.webp`
 */
export function buildThumbnailObjectKey(sourceObjectKey: string): string {
  const trimmed = sourceObjectKey.replace(/^\/+|\/+$/g, "");
  const slash = trimmed.lastIndexOf("/");
  const fileName = slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
  const directory = slash >= 0 ? trimmed.slice(0, slash) : "";
  const dash = fileName.indexOf("-");
  const prefix =
    dash > 0 ? fileName.slice(0, dash) : fileName.replace(/\.[^.]+$/, "") || "asset";
  const name = `${prefix}-thumbnail.webp`;
  return directory ? `${directory}/${name}` : name;
}
