import { NextResponse } from "next/server";
import { messages } from "@/messages";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

type ErrorBody = {
  message?: string | string[];
  error?: string;
};

function remapPortalPath(path: string): string {
  if (path.startsWith("/portal/v1/canvases")) {
    return path.replace("/portal/v1/canvases", "/api/canvases");
  }
  if (path === "/portal/v1/models") {
    return "/api/models";
  }
  if (path.startsWith("/portal/v1/auth/me")) {
    return "/api/auth/get-session";
  }
  if (path.startsWith("/portal/v1/tasks/")) {
    return path.replace("/portal/v1/tasks/", "/api/tasks/");
  }
  if (path.startsWith("/portal/v1/assets")) {
    return path.replace("/portal/v1/assets", "/api/assets");
  }
  return path;
}

function normalizeCanvasDetail(payload: Record<string, unknown>) {
  const graph = (payload.graph as Record<string, unknown> | undefined) ?? {
    schemaVersion: 1,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  return {
    thumbnailAssetId: null,
    thumbnailUrl: null,
    previewUrl: null,
    previewType: null,
    nodeCount: nodes.length,
    assets: [],
    ...payload,
    graph,
  };
}

function normalizeCanvasList(payload: Record<string, unknown>) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  return {
    ...payload,
    items: items.map((item) => {
      if (!item || typeof item !== "object") {
        return item;
      }
      const record = item as Record<string, unknown>;
      return {
        thumbnailAssetId: null,
        thumbnailUrl: null,
        previewUrl: null,
        previewType: null,
        nodeCount: typeof record.nodeCount === "number" ? record.nodeCount : 0,
        ...record,
      };
    }),
  };
}

export async function adminRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return apiRequest<T>(path, init);
}

export async function portalRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return apiRequest<T>(path, init);
}

async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const mapped = remapPortalPath(path);

  // Editor-local runs never reach the server; the active-run probe is a no-op.
  if (mapped.startsWith("/api/canvases/") && mapped.endsWith("/runs/active")) {
    return null as T;
  }
  if (mapped.startsWith("/api/tasks/")) {
    throw new ApiRequestError("Task API not configured yet", 501);
  }
  if (mapped === "/api/models") {
    return [] as T;
  }
  if (mapped.startsWith("/admin/v1/settings")) {
    return { currencySymbol: "¥" } as T;
  }

  const headers = new Headers(init.headers);
  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(mapped, {
    ...init,
    credentials: "include",
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => null)) as
    | T
    | ErrorBody
    | null;
  if (!response.ok) {
    const body = (payload ?? {}) as ErrorBody;
    const message = Array.isArray(body.message)
      ? body.message.join("；")
      : body.message || body.error || messages.requestFailed;
    throw new ApiRequestError(String(message), response.status, body.error);
  }

  if (mapped === "/api/auth/get-session") {
    const sessionPayload = payload as {
      session?: unknown;
      user?: { id: string; email?: string; name?: string };
    } | null;
    if (!sessionPayload?.user) {
      throw new ApiRequestError("Unauthorized", 401);
    }
    return {
      id: sessionPayload.user.id,
      email: sessionPayload.user.email ?? "",
      role: "owner",
      hasPassword: true,
      tenant: {
        id: "local",
        name: sessionPayload.user.name ?? "Local",
        balance: "0",
        status: "enabled",
        defaultChatRpm: 0,
        defaultImageRpm: 0,
        defaultVideoRpm: 0,
      },
    } as T;
  }

  if (
    mapped.startsWith("/api/canvases/") &&
    !mapped.includes("?") &&
    init.method !== "DELETE" &&
    payload &&
    typeof payload === "object" &&
    "id" in (payload as object)
  ) {
    return normalizeCanvasDetail(payload as Record<string, unknown>) as T;
  }

  if (
    (mapped === "/api/canvases" || mapped.startsWith("/api/canvases?")) &&
    payload &&
    typeof payload === "object" &&
    "items" in (payload as object)
  ) {
    return normalizeCanvasList(payload as Record<string, unknown>) as T;
  }

  if (
    mapped === "/api/canvases" &&
    init.method === "POST" &&
    payload &&
    typeof payload === "object"
  ) {
    return normalizeCanvasDetail(payload as Record<string, unknown>) as T;
  }

  return payload as T;
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 401;
}

export function getAdminApiBaseUrl(): string {
  return "";
}
