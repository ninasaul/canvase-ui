"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LOCALE_COOKIE_KEY,
  localeHtmlLang,
  setActiveLocale,
  type Locale,
} from "@/messages";
import { replaceLocaleInPathname } from "@/lib/i18n-path";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function writeLocaleCookie(locale: Locale) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE_KEY}=${locale}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function LocaleProvider({
  children,
  locale,
}: {
  children: ReactNode;
  locale: Locale;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/";

  setActiveLocale(locale);

  useEffect(() => {
    setActiveLocale(locale);
    document.documentElement.lang = localeHtmlLang[locale];
    writeLocaleCookie(locale);
  }, [locale]);

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) {
        return;
      }
      writeLocaleCookie(next);
      setActiveLocale(next);
      document.documentElement.lang = localeHtmlLang[next];
      const search =
        typeof window !== "undefined" ? window.location.search : "";
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      router.replace(
        `${replaceLocaleInPathname(pathname, next)}${search}${hash}`,
      );
    },
    [locale, pathname, router],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
    }),
    [locale, setLocale],
  );

  return <LocaleContext value={value}>{children}</LocaleContext>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}
