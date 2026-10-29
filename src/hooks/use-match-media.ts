"use client";

import { useSyncExternalStore } from "react";

function subscribeMatchMedia(query: string, onStoreChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

/**
 * SSR-safe matchMedia subscription. Server snapshot is always `false`
 * so first client paint may briefly match desktop until hydrated.
 */
export function useMatchMedia(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => subscribeMatchMedia(query, onStoreChange),
    () => window.matchMedia(query).matches,
    () => false,
  );
}
