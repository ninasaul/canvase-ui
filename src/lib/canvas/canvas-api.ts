"use client";

import type { CanvasGraph } from "@/lib/tu-shared-browser";
import { ApiRequestError, portalRequest } from "@/lib/api";
import { uploadPlaygroundAssetWithMeta } from "@/lib/playground-media";

export type CanvasSummary = {
  id: string;
  title: string;
  version: number;
  status: string;
  thumbnailAssetId: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  previewType: "image" | "video" | null;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CanvasDetail = CanvasSummary & {
  graph: CanvasGraph;
  assets: { assetId: string; nodeId: string }[];
};

export type CanvasListResponse = {
  items: CanvasSummary[];
  total: number;
  page: number;
  limit: number;
};

export type CanvasRunSummary = {
  id: string;
  canvasId: string;
  mode: string;
  status: string;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  nodeCount: number;
};

export function isCanvasVersionConflict(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 409;
}

export async function listCanvases(options?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<CanvasListResponse> {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.search?.trim()) params.set("search", options.search.trim());
  const query = params.toString();
  return portalRequest<CanvasListResponse>(
    `/portal/v1/canvases${query ? `?${query}` : ""}`,
  );
}

export async function getCanvas(id: string): Promise<CanvasDetail> {
  return portalRequest<CanvasDetail>(`/portal/v1/canvases/${id}`);
}

export async function createCanvas(input: {
  title: string;
  graph: CanvasGraph;
}): Promise<CanvasDetail> {
  return portalRequest<CanvasDetail>("/portal/v1/canvases", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateCanvas(
  id: string,
  input: {
    version: number;
    title?: string;
    graph?: CanvasGraph;
  },
): Promise<CanvasDetail> {
  return portalRequest<CanvasDetail>(`/portal/v1/canvases/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteCanvas(id: string): Promise<{ ok: true }> {
  return portalRequest<{ ok: true }>(`/portal/v1/canvases/${id}`, {
    method: "DELETE",
  });
}

export async function duplicateCanvas(
  id: string,
  title?: string,
): Promise<CanvasDetail> {
  return portalRequest<CanvasDetail>(`/portal/v1/canvases/${id}/duplicate`, {
    method: "POST",
    body: JSON.stringify(title ? { title } : {}),
  });
}

export async function uploadCanvasThumbnail(
  id: string,
  file: File,
): Promise<{ thumbnailAssetId: string; thumbnailUrl: string }> {
  const uploaded = await uploadPlaygroundAssetWithMeta(file, {
    allowedKinds: ["image"],
    purpose: "canvas_thumbnail",
    filename: file.name || "thumbnail",
  });
  return portalRequest<{ thumbnailAssetId: string; thumbnailUrl: string }>(
    `/portal/v1/canvases/${id}/thumbnail`,
    {
      method: "POST",
      body: JSON.stringify({ assetId: uploaded.assetId }),
    },
  );
}

export type CanvasRunNodeDetail = {
  nodeId: string;
  status:
    | "pending"
    | "queued"
    | "running"
    | "succeeded"
    | "failed"
    | "skipped"
    | "cancelled"
    | "interrupted";
  error: string | null;
  outputUrl: string | null;
  assetId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  requestId: string | null;
  taskId: string | null;
  data: Record<string, unknown> | null;
};

export type CanvasRunDetail = {
  id: string;
  canvasId: string;
  mode: "all" | "selected" | "from" | "retry-failed";
  status:
    | "queued"
    | "running"
    | "succeeded"
    | "partial"
    | "failed"
    | "cancelled";
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  nodes: CanvasRunNodeDetail[];
};

export async function createCanvasRun(
  canvasId: string,
  input: {
    mode: CanvasRunDetail["mode"];
    selectedNodeIds: string[];
    apiKeyId: string;
  },
): Promise<CanvasRunDetail> {
  return portalRequest<CanvasRunDetail>(
    `/portal/v1/canvases/${canvasId}/runs`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function listCanvasRuns(
  canvasId: string,
  limit = 20,
): Promise<CanvasRunSummary[]> {
  return portalRequest<CanvasRunSummary[]>(
    `/portal/v1/canvases/${canvasId}/runs?limit=${limit}`,
  );
}

export async function getActiveCanvasRun(
  canvasId: string,
): Promise<CanvasRunDetail | null> {
  return portalRequest<CanvasRunDetail | null>(
    `/portal/v1/canvases/${canvasId}/runs/active`,
  );
}

export async function getCanvasRun(
  canvasId: string,
  runId: string,
): Promise<CanvasRunDetail> {
  return portalRequest<CanvasRunDetail>(
    `/portal/v1/canvases/${canvasId}/runs/${runId}`,
  );
}

export async function cancelCanvasRun(
  canvasId: string,
  runId: string,
): Promise<CanvasRunDetail> {
  return portalRequest<CanvasRunDetail>(
    `/portal/v1/canvases/${canvasId}/runs/${runId}/cancel`,
    { method: "POST" },
  );
}

export type AgentTokenListItem = {
  id: string;
  label: string;
  scopes: string[];
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  active: boolean;
};

export type AgentTokenCreated = {
  id: string;
  token: string;
  canvasId: string;
  scopes: string[];
  label: string;
  expiresAt: string;
  mcpConfig: {
    mcpServers: {
      "canvase-canvas": {
        command: string;
        args: string[];
        env: Record<string, string>;
      };
    };
  };
  env: {
    CANVASE_BASE_URL: string;
    CANVASE_TOKEN: string;
    CANVASE_CANVAS_ID: string;
  };
};

export async function listAgentTokens(
  canvasId: string,
): Promise<{ items: AgentTokenListItem[] }> {
  return portalRequest<{ items: AgentTokenListItem[] }>(
    `/api/agent/tokens?canvasId=${encodeURIComponent(canvasId)}`,
  );
}

export async function createAgentToken(input: {
  canvasId: string;
  scopes?: string[];
  label?: string;
  ttlHours?: number;
}): Promise<AgentTokenCreated> {
  return portalRequest<AgentTokenCreated>("/api/agent/tokens", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function revokeAgentToken(
  tokenId: string,
): Promise<{ ok: true }> {
  return portalRequest<{ ok: true }>(`/api/agent/tokens/${tokenId}`, {
    method: "DELETE",
  });
}

export type AgentRunNodeStateView = {
  status:
    | "pending"
    | "queued"
    | "running"
    | "succeeded"
    | "failed"
    | "skipped"
    | "cancelled";
  error?: string;
  requestId?: string;
  outputUrl?: string;
};

export type AgentRunView = {
  runId: string;
  canvasId: string;
  mode: string;
  status: string;
  nodeIds: string[];
  nodes: Record<string, AgentRunNodeStateView>;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getActiveAgentRun(
  canvasId: string,
): Promise<{ run: AgentRunView | null }> {
  return portalRequest<{ run: AgentRunView | null }>(
    `/api/agent/runs/active?canvasId=${encodeURIComponent(canvasId)}`,
  );
}

export async function cancelAgentRun(
  canvasId: string,
  runId: string,
): Promise<{ run: AgentRunView }> {
  return portalRequest<{ run: AgentRunView }>(
    `/api/agent/runs/${encodeURIComponent(runId)}/cancel?canvasId=${encodeURIComponent(canvasId)}`,
    { method: "POST" },
  );
}
