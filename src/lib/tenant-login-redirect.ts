import { defaultLocale, type Locale } from "@/lib/i18n-path";

const DEFAULT_AFTER_SIGNIN = "/canvas";
const SIGNIN_PATH = "/login";

function isSafePath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return false;
  }
  try {
    const url = new URL(path, "http://local.invalid");
    if (url.origin !== "http://local.invalid") {
      return false;
    }
    if (
      url.pathname === SIGNIN_PATH ||
      url.pathname.startsWith(`${SIGNIN_PATH}/`) ||
      url.pathname === "/register" ||
      url.pathname.startsWith("/register/")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function tenantSignInRedirectPath(
  next: string | null | undefined,
  _locale: Locale = defaultLocale,
): string {
  if (!next) {
    return DEFAULT_AFTER_SIGNIN;
  }
  try {
    const decoded = decodeURIComponent(next);
    if (!isSafePath(decoded)) {
      return DEFAULT_AFTER_SIGNIN;
    }
    return decoded;
  } catch {
    return DEFAULT_AFTER_SIGNIN;
  }
}

export function tenantSignInHref(
  nextPath?: string | null,
  _locale?: Locale,
): string {
  if (!nextPath || !isSafePath(nextPath)) {
    return SIGNIN_PATH;
  }
  return `${SIGNIN_PATH}?next=${encodeURIComponent(nextPath)}`;
}

export function currentPathForTenantSignIn(): string {
  return `${window.location.pathname}${window.location.search}`;
}
