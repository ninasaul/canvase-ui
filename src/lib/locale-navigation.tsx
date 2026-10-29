"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  forwardRef,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from "react";

import {
  defaultLocale,
  isLocale,
  stripLocalePath,
  withLocale,
  type Locale,
} from "@/lib/i18n-path";

export function useLocaleParam(): Locale {
  const params = useParams();
  const value = params?.locale;
  if (typeof value === "string" && isLocale(value)) {
    return value;
  }
  return defaultLocale;
}

/** Current path without `/{locale}` prefix. */
export function useBarePathname(): string {
  return stripLocalePath(usePathname() || "/");
}

export function useLocalizedHref(path: string): string {
  return withLocale(useLocaleParam(), path);
}

export function useLocaleRouter() {
  const router = useRouter();
  const locale = useLocaleParam();

  return {
    locale,
    push(path: string) {
      router.push(withLocale(locale, path));
    },
    replace(path: string) {
      router.replace(withLocale(locale, path));
    },
  };
}

type LocaleLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  locale?: Locale;
};

/**
 * Link that accepts locale-agnostic hrefs (`/overview`, `/admin/tenants`)
 * and prefixes the active (or override) locale.
 */
export const LocaleLink = forwardRef<HTMLAnchorElement, LocaleLinkProps>(
  function LocaleLink({ href, locale, ...props }, ref) {
    const activeLocale = useLocaleParam();
    const resolved =
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("//")
        ? href
        : withLocale(locale ?? activeLocale, stripLocalePath(href));
    return <Link ref={ref} href={resolved} {...props} />;
  },
);

export function localeAwareLocationReplace(path: string) {
  const locale =
    typeof window !== "undefined"
      ? getLocaleFromWindow()
      : defaultLocale;
  window.location.replace(withLocale(locale, path));
}

function getLocaleFromWindow(): Locale {
  const segment = window.location.pathname.split("/")[1];
  return isLocale(segment) ? segment : defaultLocale;
}

export function switchLocaleKeepPath(
  event: MouseEvent | null,
  nextLocale: Locale,
  pathname: string,
  search = "",
  hash = "",
): string {
  event?.preventDefault();
  const bare = stripLocalePath(pathname);
  return `${withLocale(nextLocale, bare)}${search}${hash}`;
}

export function LocaleSwitchLink({
  locale,
  children,
  className,
}: {
  locale: Locale;
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname() || "/";
  const href = `${withLocale(locale, stripLocalePath(pathname))}${typeof window !== "undefined" ? window.location.search : ""}`;
  return (
    <Link href={href} className={className} hrefLang={locale}>
      {children}
    </Link>
  );
}
