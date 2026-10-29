"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isUnauthorized } from "@/lib/api";
import {
  currentPathForTenantSignIn,
  tenantSignInHref,
} from "@/lib/tenant-login-redirect";
import { messages } from "@/messages";

export function usePortalQuery<T>(
  key: string,
  loader: () => Promise<T>,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? true;
  const router = useRouter();
  const [currentKey, setCurrentKey] = useState(key);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchLoading, setFetchLoading] = useState(enabled);
  const [reloadToken, setReloadToken] = useState(0);

  if (key !== currentKey) {
    setCurrentKey(key);
    setData(null);
    setError(null);
    if (enabled) {
      setFetchLoading(true);
    }
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    async function run() {
      setFetchLoading(true);
      try {
        const value = await loader();
        if (cancelled) {
          return;
        }
        setData(value);
        setError(null);
      } catch (caught) {
        if (cancelled) {
          return;
        }
        if (isUnauthorized(caught)) {
          router.replace(tenantSignInHref(currentPathForTenantSignIn()));
          return;
        }
        setError(caught instanceof Error ? caught.message : messages.loading);
      } finally {
        if (!cancelled) {
          setFetchLoading(false);
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, reloadToken, router]);

  const loading = !enabled || fetchLoading;

  return {
    data,
    error,
    loading,
    reload: () => {
      if (!enabled) {
        return;
      }
      setFetchLoading(true);
      setReloadToken((current) => current + 1);
    },
    setData,
  };
}
