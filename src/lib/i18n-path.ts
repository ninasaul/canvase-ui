import {
  defaultLocale,
  isLocale,
  locales,
  LOCALE_COOKIE_KEY,
  type Locale,
} from "@/messages";

export { defaultLocale, isLocale, locales, LOCALE_COOKIE_KEY };
export type { Locale };

const LOCALE_PREFIX = new RegExp(`^/(${locales.join("|")})(?=/|$)`);

/**
 * Strip `/{locale}` prefix from a pathname.
 * `/zh/canvas` -> `/canvas`, `/en` -> `/`
 */
export function stripLocalePath(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const match = path.match(LOCALE_PREFIX);
  if (!match) {
    return path === "" ? "/" : path;
  }
  const rest = path.slice(match[0].length);
  return rest.length > 0 ? rest : "/";
}

export function getLocaleFromPathname(pathname: string): Locale | null {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const segment = path.split("/")[1];
  return isLocale(segment) ? segment : null;
}

export function hasLocalePrefix(pathname: string): boolean {
  return getLocaleFromPathname(pathname) !== null;
}

/** Prefix a locale-agnostic path with `/{locale}`. */
export function withLocale(locale: Locale, path: string): string {
  const bare = stripLocalePath(path || "/");
  if (bare === "/") {
    return `/${locale}`;
  }
  return `/${locale}${bare.startsWith("/") ? bare : `/${bare}`}`;
}

export function replaceLocaleInPathname(
  pathname: string,
  nextLocale: Locale,
): string {
  return withLocale(nextLocale, stripLocalePath(pathname));
}
