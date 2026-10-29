"use client";

import { useSyncExternalStore } from "react";

function subscribeNoop() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

/** True after client hydration; false during SSR. */
export function useClientMounted(): boolean {
  return useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot);
}
