"use client";

import { useEffect, useSyncExternalStore } from "react";
import { isUnauthorized, portalRequest } from "@/lib/api";
import type { PortalSession } from "@/types/admin";

type PortalSessionState = {
  session: PortalSession | null;
  loading: boolean;
  error: string | null;
};

let state: PortalSessionState = {
  session: null,
  loading: false,
  error: null,
};
let inFlight: Promise<void> | null = null;
let loadedAt = 0;
const SESSION_TTL_MS = 30_000;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function setState(next: PortalSessionState) {
  state = next;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): PortalSessionState {
  return state;
}

const SERVER_STATE: PortalSessionState = {
  session: null,
  loading: false,
  error: null,
};

function getServerSnapshot(): PortalSessionState {
  return SERVER_STATE;
}

async function loadSession(): Promise<void> {
  if (inFlight) {
    return inFlight;
  }
  setState({ ...state, loading: true, error: null });
  inFlight = portalRequest<PortalSession>("/portal/v1/auth/me")
    .then((session) => {
      loadedAt = Date.now();
      setState({ session, loading: false, error: null });
    })
    .catch((error: unknown) => {
      if (isUnauthorized(error)) {
        setState({ session: null, loading: false, error: null });
        return;
      }
      setState({
        session: null,
        loading: false,
        error: error instanceof Error ? error.message : "session error",
      });
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function usePortalSession() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    if (Date.now() - loadedAt > SESSION_TTL_MS || !state.session) {
      void loadSession();
    }
  }, []);

  return {
    ...snapshot,
    reload: () => {
      loadedAt = 0;
      void loadSession();
    },
  };
}
