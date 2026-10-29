"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useLocaleParam } from "@/lib/locale-navigation";
import { usePortalSession } from "@/lib/portal-session";
import { setPlaygroundStorageScope } from "@/lib/playground-storage-scope";
import {
  currentPathForTenantSignIn,
  tenantSignInHref,
} from "@/lib/tenant-login-redirect";
import { messages } from "@/messages";

export function PlaygroundPopoutShell({
  children,
}: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const locale = useLocaleParam();
  const { session, error } = usePortalSession();

  useEffect(() => {
    if (session) {
      setPlaygroundStorageScope(session.id);
      return;
    }
    if (error) {
      setPlaygroundStorageScope("");
      router.replace(tenantSignInHref(currentPathForTenantSignIn(), locale));
    }
  }, [error, locale, router, session]);

  if (!session) {
    return (
      <div className="flex h-dvh items-center justify-center bg-white text-sm text-zinc-500 dark:bg-zinc-950">
        {messages.loading}
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-white dark:bg-zinc-950">
      {children}
    </div>
  );
}
