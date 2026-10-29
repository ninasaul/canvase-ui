import type { ApiKeyRecord } from "@/types/admin";
import { portalRequest } from "@/lib/api";
import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage,
} from "@/lib/playground-browser-storage";
import {
  migratePlaygroundLegacyStorageKey,
  playgroundScopedStorageKey,
} from "@/lib/playground-storage-scope";
import { V1RequestError } from "@/lib/v1-client";

/** Unscoped base key (docs + legacy). Runtime uses {@link apiKeyStorageKey}. */
export const PLAYGROUND_API_KEY_STORAGE = "docs-playground.api-key";

/** Temporary portal-issued bearer; must match API `PLAYGROUND_BEARER_PREFIX`. */
export const PLAYGROUND_BEARER_PREFIX = "sk_pg_";

const VAULT_STORAGE = "docs-playground.api-key-vault";
const SELECTED_ID_STORAGE = "docs-playground.api-key-selected-id";

function apiKeyStorageKey(): string {
  migratePlaygroundLegacyStorageKey(PLAYGROUND_API_KEY_STORAGE);
  return playgroundScopedStorageKey(PLAYGROUND_API_KEY_STORAGE);
}

function vaultStorageKey(): string {
  migratePlaygroundLegacyStorageKey(VAULT_STORAGE);
  return playgroundScopedStorageKey(VAULT_STORAGE);
}

function selectedIdStorageKey(): string {
  migratePlaygroundLegacyStorageKey(SELECTED_ID_STORAGE);
  return playgroundScopedStorageKey(SELECTED_ID_STORAGE);
}

export type ApiKeyVault = Record<string, string>;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = readBrowserStorage(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    writeBrowserStorage(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export function readApiKeyVault(): ApiKeyVault {
  return readJson<ApiKeyVault>(vaultStorageKey(), {});
}

export function writeApiKeyVaultEntry(id: string, plaintext: string): void {
  const trimmed = plaintext.trim();
  if (!trimmed) {
    return;
  }
  const vault = readApiKeyVault();
  vault[id] = trimmed;
  writeJson(vaultStorageKey(), vault);
  writePlaygroundApiKey(trimmed);
}

export function removeApiKeyVaultEntry(id: string): void {
  const vault = readApiKeyVault();
  if (!(id in vault)) {
    return;
  }
  delete vault[id];
  writeJson(vaultStorageKey(), vault);
}

export function readSelectedApiKeyId(): string {
  return readBrowserStorage(selectedIdStorageKey()) ?? "";
}

export function writeSelectedApiKeyId(id: string): void {
  if (id) {
    writeBrowserStorage(selectedIdStorageKey(), id);
  } else {
    removeBrowserStorage(selectedIdStorageKey());
  }
}

export function readPlaygroundApiKey(): string {
  return readBrowserStorage(apiKeyStorageKey()) ?? "";
}

export function writePlaygroundApiKey(value: string): void {
  if (value.trim()) {
    writeBrowserStorage(apiKeyStorageKey(), value);
  } else {
    removeBrowserStorage(apiKeyStorageKey());
  }
}

export function matchApiKeyId(
  plaintext: string,
  keys: ApiKeyRecord[],
): string | null {
  const trimmed = plaintext.trim();
  if (!trimmed) {
    return null;
  }
  for (const key of keys) {
    if (
      trimmed.startsWith(key.keyPrefix) &&
      trimmed.endsWith(key.keySuffix)
    ) {
      return key.id;
    }
  }
  return null;
}

export function resolveVaultPlaintext(
  keyId: string,
  vault: ApiKeyVault,
): string {
  return vault[keyId]?.trim() ?? "";
}

export function filterUsableApiKeys(
  keys: ApiKeyRecord[],
  vault: ApiKeyVault,
): ApiKeyRecord[] {
  return keys.filter(
    (key) =>
      key.status === "active" && Boolean(resolveVaultPlaintext(key.id, vault)),
  );
}

export function pickDefaultApiKeyId(
  keys: ApiKeyRecord[],
  vault: ApiKeyVault,
  preferredId: string,
): string {
  const active = keys.filter((key) => key.status === "active");
  if (active.length === 0) {
    return "";
  }
  const usable = filterUsableApiKeys(keys, vault);
  if (preferredId && active.some((key) => key.id === preferredId)) {
    return preferredId;
  }
  if (usable.length > 0) {
    return usable[0]!.id;
  }
  return active[0]!.id;
}

export function isPlaygroundBearerToken(token: string): boolean {
  return token.trim().startsWith(PLAYGROUND_BEARER_PREFIX);
}

export async function fetchPlaygroundToken(keyId: string): Promise<string> {
  const response = await portalRequest<{ token: string }>(
    `/portal/v1/api-keys/${keyId}/playground-token`,
    { method: "POST" },
  );
  return response.token;
}

/**
 * Resolve a credential for playground requests.
 * Permanent customer keys are reused from the vault; temporary `sk_pg_` bearers
 * are always reissued (Redis TTL is 24h; browser cache must not outlive it).
 */
export async function resolvePlaygroundCredential(keyId: string): Promise<string> {
  const vault = readApiKeyVault();
  const cached = resolveVaultPlaintext(keyId, vault);
  if (cached && !isPlaygroundBearerToken(cached)) {
    return cached;
  }
  // Local BYOK never uses portal-issued temporary bearers.
  if (keyId === "local-byok") {
    return cached;
  }
  const token = await fetchPlaygroundToken(keyId);
  writeApiKeyVaultEntry(keyId, token);
  return token;
}

/**
 * After a 401 on a temporary playground bearer, drop the stale vault entry and
 * issue a fresh token for the currently selected key id.
 */
export async function reissuePlaygroundCredential(
  expiredToken: string,
): Promise<string | null> {
  const trimmed = expiredToken.trim();
  if (!isPlaygroundBearerToken(trimmed)) {
    return null;
  }
  const keyId = readSelectedApiKeyId();
  if (!keyId) {
    return null;
  }
  const vault = readApiKeyVault();
  const cached = resolveVaultPlaintext(keyId, vault);
  if (cached && cached !== trimmed && isPlaygroundBearerToken(cached)) {
    writePlaygroundApiKey(cached);
    return cached;
  }
  removeApiKeyVaultEntry(keyId);
  if (readPlaygroundApiKey().trim() === trimmed) {
    writePlaygroundApiKey("");
  }
  try {
    const token = await fetchPlaygroundToken(keyId);
    writeApiKeyVaultEntry(keyId, token);
    return token;
  } catch {
    return null;
  }
}

/** Run a playground V1 call; on 401 with `sk_pg_`, reissue once and retry. */
export async function runWithPlaygroundAuthRetry<T>(
  apiKey: string,
  run: (credential: string) => Promise<T>,
  onCredential?: (credential: string) => void,
): Promise<T> {
  try {
    return await run(apiKey);
  } catch (error) {
    if (
      !(error instanceof V1RequestError) ||
      error.status !== 401 ||
      !isPlaygroundBearerToken(apiKey)
    ) {
      throw error;
    }
    const refreshed = await reissuePlaygroundCredential(apiKey);
    if (!refreshed || refreshed === apiKey.trim()) {
      throw error;
    }
    onCredential?.(refreshed);
    return run(refreshed);
  }
}
