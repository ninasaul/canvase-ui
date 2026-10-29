/** Isolates playground localStorage by portal user id. */

import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage,
} from "./playground-browser-storage";

let storageScopeId = "";
const scopeListeners = new Set<() => void>();

export function getPlaygroundStorageScope(): string {
  return storageScopeId;
}

/**
 * Bind browser persistence to the signed-in portal user.
 * Empty string = unscoped (docs playground / signed out).
 */
export function setPlaygroundStorageScope(userId: string): void {
  const next = userId.trim();
  if (next === storageScopeId) {
    return;
  }
  storageScopeId = next;
  for (const listener of scopeListeners) {
    listener();
  }
}

export function subscribePlaygroundStorageScope(listener: () => void): () => void {
  scopeListeners.add(listener);
  return () => {
    scopeListeners.delete(listener);
  };
}

/** `baseKey` when unscoped; `baseKey.uid.<userId>` when scoped. */
export function playgroundScopedStorageKey(baseKey: string): string {
  if (!storageScopeId) {
    return baseKey;
  }
  return `${baseKey}.uid.${storageScopeId}`;
}

/**
 * One-shot: copy unscoped legacy value into the current user's key, then drop legacy.
 * Skipped when unscoped or when the scoped key already exists.
 */
export function migratePlaygroundLegacyStorageKey(baseKey: string): void {
  const scoped = playgroundScopedStorageKey(baseKey);
  if (scoped === baseKey) {
    return;
  }
  if (readBrowserStorage(scoped) !== null) {
    return;
  }
  const legacy = readBrowserStorage(baseKey);
  if (legacy === null) {
    return;
  }
  writeBrowserStorage(scoped, legacy);
  removeBrowserStorage(baseKey);
}
