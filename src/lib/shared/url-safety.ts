import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Outbound URL guard for server-side fetches driven by user input
 * (`/v1` upstream base URL, agent chat attachments).
 *
 * Blocks loopback / private / link-local targets unless explicitly allowed:
 * local gateways (Ollama, LM Studio) and MinIO need
 *   GENERATION_ALLOW_PRIVATE_HOSTS=true
 * A host allowlist can be pinned with
 *   GENERATION_ALLOWED_HOSTS="api.openai.com,gateway.example.com"
 */

export type RemoteUrlPolicy = {
  /** Allow loopback / private / link-local targets. */
  allowPrivate: boolean;
  /** When non-empty, the hostname must match one of these (suffix match). */
  allowedHosts: string[];
};

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function flag(name: string): boolean {
  return (process.env[name] ?? "").trim().toLowerCase() === "true";
}

function parseHostList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function readRemoteUrlPolicy(): RemoteUrlPolicy {
  return {
    allowPrivate: flag("GENERATION_ALLOW_PRIVATE_HOSTS"),
    allowedHosts: parseHostList(process.env.GENERATION_ALLOWED_HOSTS),
  };
}

function isPrivateIpv4(address: string): boolean {
  const [a, b] = address.split(".").map(Number);
  if (a === undefined || b === undefined) {
    return true;
  }
  if (a === 0 || a === 10 || a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  // NOTE: 198.18.0.0/15 is RFC 2544 benchmarking space, but transparent
  // proxies (sandboxes, some corporate networks) resolve public hosts there.
  // It routes nowhere internal, so it is deliberately not treated as private.
  return false;
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::") {
    return true;
  }
  // IPv4-mapped (::ffff:127.0.0.1)
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mapped?.[1]) {
    return isPrivateIpv4(mapped[1]);
  }
  // Unique local (fc00::/7) and link-local (fe80::/10)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
      normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true;
  }
  return false;
}

function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    return isPrivateIpv4(address);
  }
  if (version === 6) {
    return isPrivateIpv6(address);
  }
  return true;
}

function hostAllowed(hostname: string, allowedHosts: string[]): boolean {
  if (allowedHosts.length === 0) {
    return true;
  }
  return allowedHosts.some(
    (allowed) =>
      hostname === allowed ||
      hostname.endsWith(`.${allowed}`),
  );
}

/**
 * Validate a URL that the server is about to fetch on a user's behalf.
 * Throws {@link UnsafeUrlError} when the target is not acceptable.
 */
export async function assertSafeRemoteUrl(
  raw: string,
  policy: RemoteUrlPolicy = readRemoteUrlPolicy(),
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http(s) URLs are allowed");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("Credentials in URL are not allowed");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostAllowed(hostname, policy.allowedHosts)) {
    throw new UnsafeUrlError(`Host not allowed: ${hostname}`);
  }
  if (policy.allowPrivate) {
    return url;
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new UnsafeUrlError(
        `Private network targets are blocked: ${hostname}`,
      );
    }
    return url;
  }

  // Resolve once so DNS names pointing at internal ranges are rejected too.
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError(`Cannot resolve host: ${hostname}`);
  }
  if (addresses.length === 0) {
    throw new UnsafeUrlError(`Cannot resolve host: ${hostname}`);
  }
  for (const entry of addresses) {
    if (isPrivateAddress(entry.address)) {
      throw new UnsafeUrlError(
        `Host resolves to a private address: ${hostname}`,
      );
    }
  }
  return url;
}

/** Same as {@link assertSafeRemoteUrl} but returns null instead of throwing. */
export async function isSafeRemoteUrl(
  raw: string,
  policy?: RemoteUrlPolicy,
): Promise<boolean> {
  try {
    await assertSafeRemoteUrl(raw, policy);
    return true;
  } catch {
    return false;
  }
}
