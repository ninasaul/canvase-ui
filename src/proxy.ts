import { NextResponse, type NextRequest } from "next/server";
import {
  defaultLocale,
  isLocale,
  locales,
  LOCALE_COOKIE_KEY,
  type Locale,
} from "@/lib/i18n-path";

function negotiateLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE_KEY)?.value;
  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }

  const header = request.headers.get("accept-language") ?? "";
  const preferred = header
    .split(",")
    .map((part) => part.trim().split(";")[0]?.toLowerCase() ?? "")
    .filter(Boolean);

  for (const tag of preferred) {
    if (isLocale(tag)) {
      return tag;
    }
    const base = tag.split("-")[0];
    if (isLocale(base)) {
      return base;
    }
  }

  return defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const pathnameHasLocale = locales.some(
    (locale) =>
      pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );
  if (pathnameHasLocale) {
    const locale = pathname.split("/")[1];
    const response = NextResponse.next();
    if (isLocale(locale)) {
      response.cookies.set(LOCALE_COOKIE_KEY, locale, {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return response;
  }

  const locale = negotiateLocale(request);
  const url = request.nextUrl.clone();
  url.pathname =
    pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
  const response = NextResponse.redirect(url);
  response.cookies.set(LOCALE_COOKIE_KEY, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export const config = {
  matcher: [
    "/((?!api|v1|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
