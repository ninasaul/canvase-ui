import {
  BYOK_API_KEY_HEADER,
  BYOK_BASE_HEADER,
  BYOK_VENDOR_HEADER,
  GENERATION_API_KEY_HEADER,
  GENERATION_BASE_HEADER,
  GENERATION_VENDOR_HEADER,
  normalizeGenerationBaseUrl,
} from "@/lib/generation/byok-url";
import { resolveUserGenerationApiKey } from "@/lib/generation/generation-config-server";
import { assertSafeRemoteUrl, UnsafeUrlError } from "@/lib/shared/url-safety";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function buildUpstreamUrl(baseUrl: string, pathParts: string[], search: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const suffix = pathParts.map(encodeURIComponent).join("/");
  // Upstream expects /v1/... — our route is already under /v1/*
  return `${base}/v1/${suffix}${search}`;
}

function resolveClientBaseUrl(request: Request): string {
  return (
    request.headers.get(GENERATION_BASE_HEADER) ??
    request.headers.get(BYOK_BASE_HEADER) ??
    ""
  );
}

function resolveClientVendorId(request: Request): string {
  return (
    request.headers.get(GENERATION_VENDOR_HEADER) ??
    request.headers.get(BYOK_VENDOR_HEADER) ??
    ""
  ).trim();
}

function resolveClientApiKey(request: Request): string {
  return (
    request.headers.get(GENERATION_API_KEY_HEADER) ??
    request.headers.get(BYOK_API_KEY_HEADER) ??
    ""
  ).trim();
}

async function resolveUpstreamApiKey(request: Request): Promise<string> {
  const clientKey = resolveClientApiKey(request);
  if (clientKey) {
    return clientKey;
  }

  const user = await requireUser();
  if (user) {
    const stored = await resolveUserGenerationApiKey(user.id, {
      vendorId: resolveClientVendorId(request) || null,
      baseUrl: resolveClientBaseUrl(request) || null,
    });
    if (stored) {
      return stored;
    }
  }

  return (process.env.GENERATION_API_KEY ?? "").trim();
}

async function proxyRequest(request: Request, context: RouteContext) {
  const { path } = await context.params;
  if (!path || path.length === 0) {
    return Response.json({ error: "Missing path" }, { status: 400 });
  }

  // Same-origin proxy for signed-in editors only. Server-side callers
  // (agent runs / agent chat) call the gateway directly instead.
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const headerBase = resolveClientBaseUrl(request);
  const envBase = process.env.GENERATION_BASE_URL ?? "";
  const baseUrl = normalizeGenerationBaseUrl(headerBase || envBase);
  if (!baseUrl) {
    return Response.json(
      {
        error:
          "Missing generation base URL. Open Model settings and set Base URL, or set GENERATION_BASE_URL on the server.",
      },
      { status: 400 },
    );
  }

  const upstreamUrl = buildUpstreamUrl(
    baseUrl,
    path,
    new URL(request.url).search,
  );

  // Block SSRF: the base URL comes from a request header, so it must not be
  // able to reach loopback / private / link-local addresses.
  try {
    await assertSafeRemoteUrl(upstreamUrl);
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const headers = new Headers();
  const apiKey = await resolveUpstreamApiKey(request);
  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }

  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  headers.set("Accept", request.headers.get("accept") ?? "application/json");

  const method = request.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers,
    redirect: "manual",
  };

  if (method !== "GET" && method !== "HEAD") {
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) {
      init.body = body;
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, init);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upstream request failed";
    return Response.json({ error: message }, { status: 502 });
  }

  const responseHeaders = new Headers();
  const upstreamContentType = upstream.headers.get("content-type");
  if (upstreamContentType) {
    responseHeaders.set("Content-Type", upstreamContentType);
  }
  responseHeaders.set("Cache-Control", "no-store");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export async function GET(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}
