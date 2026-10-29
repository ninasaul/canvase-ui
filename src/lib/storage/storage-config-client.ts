import { getAdminApiBaseUrl } from "@/lib/api";

export type StorageConfigClientView = {
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

export type StorageConfigWriteInput = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey?: string;
  publicBaseUrl: string;
  forcePathStyle: boolean;
};

async function parseStorageResponse(
  response: Response,
): Promise<StorageConfigClientView> {
  const payload = (await response.json().catch(() => null)) as
    | (StorageConfigClientView & { error?: string; message?: string })
    | null;
  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      `Storage config request failed (${response.status})`;
    throw new Error(typeof message === "string" ? message : "Request failed");
  }
  if (!payload) {
    throw new Error("Invalid storage config response");
  }
  return {
    configured: Boolean(payload.configured),
    source: payload.source === "user" || payload.source === "env" ? payload.source : "none",
    endpoint: payload.endpoint ?? "",
    region: payload.region ?? "auto",
    bucket: payload.bucket ?? "",
    accessKeyId: payload.accessKeyId ?? "",
    secretConfigured: Boolean(payload.secretConfigured),
    publicBaseUrl: payload.publicBaseUrl ?? "",
    forcePathStyle: payload.forcePathStyle !== false,
  };
}

export async function readStorageConfig(): Promise<StorageConfigClientView> {
  const response = await fetch(`${getAdminApiBaseUrl()}/api/storage-config`, {
    method: "GET",
    credentials: "include",
  });
  return parseStorageResponse(response);
}

export async function writeStorageConfig(
  input: StorageConfigWriteInput,
): Promise<StorageConfigClientView> {
  const response = await fetch(`${getAdminApiBaseUrl()}/api/storage-config`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseStorageResponse(response);
}

export type StorageConfigTestResult = {
  ok: true;
  source: "user" | "env";
  endpoint: string;
  bucket: string;
  publicBaseUrl: string;
};

export async function testStorageConfig(
  input?: StorageConfigWriteInput,
): Promise<StorageConfigTestResult> {
  const response = await fetch(
    `${getAdminApiBaseUrl()}/api/storage-config/test`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input ?? {}),
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | (StorageConfigTestResult & { error?: string; message?: string })
    | null;
  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      `Storage test failed (${response.status})`;
    throw new Error(typeof message === "string" ? message : "Storage test failed");
  }
  if (!payload?.ok) {
    throw new Error("Storage test failed");
  }
  return {
    ok: true,
    source: payload.source === "env" ? "env" : "user",
    endpoint: payload.endpoint ?? "",
    bucket: payload.bucket ?? "",
    publicBaseUrl: payload.publicBaseUrl ?? "",
  };
}
