/** Pure URL helpers for BYOK (safe on server and client). */

export function normalizeGenerationBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) {
    return "";
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }
    let path = url.pathname.replace(/\/$/, "");
    if (path.endsWith("/v1")) {
      path = path.slice(0, -3);
    }
    return `${url.protocol}//${url.host}${path}`.replace(/\/$/, "");
  } catch {
    return "";
  }
}

/** Preferred header for open-source model Base URL. */
export const GENERATION_BASE_HEADER = "x-generation-base-url";
/** Legacy alias kept for older clients. */
export const BYOK_BASE_HEADER = "x-byok-base-url";
/** Browser-supplied upstream API key (proxy forwards as Authorization). */
export const GENERATION_API_KEY_HEADER = "x-generation-api-key";
/** Legacy alias. */
export const BYOK_API_KEY_HEADER = "x-byok-api-key";
/** Vendor gateway profile id — server decrypts stored key when client omits apiKey. */
export const GENERATION_VENDOR_HEADER = "x-generation-vendor-id";
/** Legacy alias. */
export const BYOK_VENDOR_HEADER = "x-byok-vendor-id";
