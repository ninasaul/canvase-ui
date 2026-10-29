import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/storage/secret-crypto";

export type ResolvedStorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
  forcePathStyle: boolean;
  source: "user" | "env";
};

export type PublicStorageConfigView = {
  configured: boolean;
  source: "user" | "env" | "none";
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretConfigured: boolean;
  publicBaseUrl: string;
  forcePathStyle: boolean;
};

/** Example / docs placeholders that must never be treated as live config. */
export function isPlaceholderStorageEndpoint(endpoint: string): boolean {
  const value = endpoint.trim().toLowerCase();
  if (!value) {
    return true;
  }
  return (
    value.includes("://xxx.") ||
    value.includes("<account") ||
    value.includes("accountid") ||
    value.includes("example.com") ||
    value.includes("changeme") ||
    value.includes("your-account")
  );
}

export function assertUsableStorageEndpoint(endpoint: string): void {
  const trimmed = endpoint.trim().replace(/\/$/, "");
  if (!trimmed) {
    throw new Error("S3 endpoint is required");
  }
  if (isPlaceholderStorageEndpoint(trimmed)) {
    throw new Error(
      "S3 endpoint still looks like a placeholder. Use your real R2/S3 host, e.g. https://<accountid>.r2.cloudflarestorage.com",
    );
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("invalid");
    }
  } catch {
    throw new Error("S3 endpoint must be a valid http(s) URL");
  }
}

function readEnvStorageConfig(): ResolvedStorageConfig | null {
  const endpoint = (process.env.S3_ENDPOINT ?? "").trim().replace(/\/$/, "");
  const region = (process.env.S3_REGION ?? "auto").trim() || "auto";
  const bucket = (process.env.S3_BUCKET ?? "").trim();
  const accessKeyId = (process.env.S3_ACCESS_KEY_ID ?? "").trim();
  const secretAccessKey = (process.env.S3_SECRET_ACCESS_KEY ?? "").trim();
  const publicBaseUrl = (process.env.S3_PUBLIC_BASE_URL ?? "")
    .trim()
    .replace(/\/$/, "");
  const forcePathStyle =
    (process.env.S3_FORCE_PATH_STYLE ?? "true").trim().toLowerCase() !==
    "false";

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    return null;
  }
  if (isPlaceholderStorageEndpoint(endpoint)) {
    return null;
  }

  return {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
    forcePathStyle,
    source: "env",
  };
}

async function readUserStorageConfig(
  userId: string,
): Promise<ResolvedStorageConfig | null> {
  const row = await prisma.userStorageConfig.findUnique({
    where: { userId },
  });
  if (!row) {
    return null;
  }
  const secretAccessKey = decryptSecret(
    row.secretAccessKeyCipher,
    row.secretAccessKeyIv,
  ).trim();
  const endpoint = row.endpoint.trim().replace(/\/$/, "");
  if (
    !endpoint ||
    isPlaceholderStorageEndpoint(endpoint) ||
    !row.bucket.trim() ||
    !row.accessKeyId.trim() ||
    !secretAccessKey ||
    !row.publicBaseUrl.trim()
  ) {
    return null;
  }
  return {
    endpoint,
    region: row.region.trim() || "auto",
    bucket: row.bucket.trim(),
    accessKeyId: row.accessKeyId.trim(),
    secretAccessKey,
    publicBaseUrl: row.publicBaseUrl.trim().replace(/\/$/, ""),
    forcePathStyle: row.forcePathStyle,
    source: "user",
  };
}

export async function resolveStorageConfig(
  userId: string,
): Promise<ResolvedStorageConfig | null> {
  const userConfig = await readUserStorageConfig(userId);
  if (userConfig) {
    return userConfig;
  }
  return readEnvStorageConfig();
}

export async function getPublicStorageConfigView(
  userId: string,
): Promise<PublicStorageConfigView> {
  const userRow = await prisma.userStorageConfig.findUnique({
    where: { userId },
  });
  if (userRow) {
    const endpoint = userRow.endpoint.trim();
    return {
      configured: Boolean(
        endpoint &&
          !isPlaceholderStorageEndpoint(endpoint) &&
          userRow.bucket.trim() &&
          userRow.accessKeyId.trim() &&
          userRow.secretAccessKeyCipher &&
          userRow.publicBaseUrl.trim(),
      ),
      source: "user",
      endpoint: userRow.endpoint,
      region: userRow.region,
      bucket: userRow.bucket,
      accessKeyId: userRow.accessKeyId,
      secretConfigured: Boolean(userRow.secretAccessKeyCipher),
      publicBaseUrl: userRow.publicBaseUrl,
      forcePathStyle: userRow.forcePathStyle,
    };
  }

  const env = readEnvStorageConfig();
  if (env) {
    return {
      configured: true,
      source: "env",
      endpoint: env.endpoint,
      region: env.region,
      bucket: env.bucket,
      accessKeyId: maskAccessKey(env.accessKeyId),
      secretConfigured: true,
      publicBaseUrl: env.publicBaseUrl,
      forcePathStyle: env.forcePathStyle,
    };
  }

  return {
    configured: false,
    source: "none",
    endpoint: "",
    region: "auto",
    bucket: "",
    accessKeyId: "",
    secretConfigured: false,
    publicBaseUrl: "",
    forcePathStyle: true,
  };
}

function maskAccessKey(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) {
    return "****";
  }
  return `${trimmed.slice(0, 4)}****`;
}

export function buildPublicObjectUrl(
  config: ResolvedStorageConfig,
  objectKey: string,
): string {
  const base = config.publicBaseUrl.replace(/\/$/, "");
  const key = objectKey.replace(/^\//, "");
  return `${base}/${key}`;
}

export function buildObjectKey(input: {
  userId: string;
  assetId: string;
  filename: string;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const safeName = sanitizeFilename(input.filename);
  return `${input.userId}/${year}/${month}/${input.assetId}-${safeName}`;
}

function sanitizeFilename(filename: string): string {
  const base = filename.trim().split(/[/\\]/).pop() || "file";
  const cleaned = base.replace(/[^\w.\-()+ ]+/g, "_").replace(/\s+/g, "-");
  return cleaned.slice(0, 120) || "file";
}
