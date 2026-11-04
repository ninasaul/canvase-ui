"use client";

import type { CanvasGraph } from "@/lib/tu-shared-browser";
import { ApiRequestError, portalRequest } from "@/lib/api";
import { uploadPlaygroundAssetWithMeta } from "@/lib/playground-media";
import { messages } from "@/messages";

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
  mode: "all" | "selected" | "node" | "from" | "retry-failed";
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

/** Records an editor-initiated run so it shows up in the run history. */
export async function recordCanvasRun(
  canvasId: string,
  input: {
    mode: "all" | "selected" | "node" | "from" | "retry-failed";
    status: "succeeded" | "partial" | "failed" | "cancelled";
    nodeIds: string[];
    nodeStates: Record<
      string,
      { status: string; error?: string | null }
    >;
    startedAt?: string;
    finishedAt?: string;
  },
): Promise<void> {
  await portalRequest<{ id: string }>(`/portal/v1/canvases/${canvasId}/runs`, {
    method: "POST",
    body: JSON.stringify(input),
  });
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

export type CanvasAgentChatMessageInput = {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  attachments?: Array<{
    url: string;
    kind?: "image" | "video" | "audio";
  }>;
  /** @deprecated Prefer attachments. */
  images?: Array<{ url: string; kind?: "image" | "video" | "audio" }>;
  toolCallId?: string;
  name?: string;
};

export type CanvasAgentChatSseEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_start"; tool: string; id: string; args?: unknown }
  | {
      type: "tool_result";
      tool: string;
      id: string;
      ok: boolean;
      summary: string;
    }
  | { type: "graph_mutated"; tool: string }
  | {
      type: "approval_request";
      id: string;
      tool: string;
      summary: string;
      details?: Record<string, unknown>;
    }
  | { type: "approval_resolved"; id: string; decision: string }
  | { type: "steer_applied"; id: string; text: string }
  | { type: "step_budget" }
  | { type: "attachment_warning"; message: string }
  | { type: "error"; message: string }
  | { type: "done" };

export type CanvasChatHistoryMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sessionId: string;
  attachments: Array<{ url: string; kind?: string; name?: string }> | null;
  createdAt: string;
};

/** Server-side transcript for the canvas agent (append-only). */
export type CanvasChatSummary = {
  sessionId: string;
  summary: string;
  /** Everything at or before this timestamp is folded into `summary`. */
  coveredThrough?: string | null;
};

export async function listCanvasChatMessages(
  canvasId: string,
  limit = 200,
): Promise<{
  messages: CanvasChatHistoryMessage[];
  summaries: CanvasChatSummary[];
}> {
  const payload = await portalRequest<{
    messages: CanvasChatHistoryMessage[];
    summaries?: CanvasChatSummary[];
  }>(`/api/canvases/${canvasId}/chat?limit=${limit}`);
  return {
    messages: Array.isArray(payload?.messages) ? payload.messages : [],
    summaries: Array.isArray(payload?.summaries) ? payload.summaries : [],
  };
}

/** Folds the oldest slice of a conversation into a rolling summary. */
export async function summarizeCanvasChat(input: {
  canvasId: string;
  sessionId: string;
  model: string;
  vendor?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  /** Timestamp of the newest message folded into this summary. */
  coveredThrough?: string;
}): Promise<{
  summary: string;
  coveredThrough?: string | null;
}> {
  return portalRequest<{
    summary: string;
    coveredThrough?: string | null;
  }>("/api/agent/summarize", {
    method: "POST",
    body: JSON.stringify({
      canvasId: input.canvasId,
      sessionId: input.sessionId,
      model: input.model,
      ...(input.vendor ? { vendor: input.vendor } : {}),
      messages: input.messages,
      ...(input.coveredThrough ? { coveredThrough: input.coveredThrough } : {}),
    }),
  });
}

export async function clearCanvasChatMessages(canvasId: string): Promise<void> {
  await portalRequest<{ deleted: number }>(`/api/canvases/${canvasId}/chat`, {
    method: "DELETE",
  });
}

/** Answers a pending agent approval (the turn is blocked until this lands). */
export async function resolveAgentApproval(
  id: string,
  decision: "allow_once" | "allow_session" | "deny",
): Promise<void> {
  const response = await fetch(
    `/api/agent/approvals/${encodeURIComponent(id)}`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text.trim() || `HTTP ${response.status}`);
  }
}

/**
 * Adds a mid-turn instruction. Returns "no-turn" (409) when nothing is
 * streaming, so the caller can send a normal message instead.
 */
export async function steerCanvasAgentChat(input: {
  canvasId: string;
  sessionId?: string;
  messageId?: string;
  content: string;
}): Promise<"queued" | "no-turn"> {
  const response = await fetch("/api/agent/steer", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      canvasId: input.canvasId,
      content: input.content,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      ...(input.messageId ? { messageId: input.messageId } : {}),
    }),
  });
  if (response.status === 409) {
    return "no-turn";
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
      error?: string;
    } | null;
    throw new ApiRequestError(
      payload?.message || payload?.error || messages.requestFailed,
      response.status,
    );
  }
  return "queued";
}

export async function streamCanvasAgentChat(input: {
  canvasId: string;
  messages: CanvasAgentChatMessageInput[];
  model: string;
  vendor?: string;
  /** Client id of this user turn; makes history persistence idempotent. */
  messageId?: string;
  /** Conversation boundary; keeps model context scoped to one session. */
  sessionId?: string;
  /** Selection / focus / viewport snapshot (agent context). */
  context?: {
    version?: number;
    selection?: string[];
    focusNodeId?: string;
    visibleNodeIds?: string[];
  };
  signal?: AbortSignal;
  onEvent: (event: CanvasAgentChatSseEvent) => void;
}): Promise<void> {
  const response = await fetch("/api/agent/chat", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      canvasId: input.canvasId,
      messages: input.messages,
      model: input.model,
      ...(input.messageId ? { messageId: input.messageId } : {}),
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      ...(input.context ? { context: input.context } : {}),
      ...(typeof input.vendor === "string" && input.vendor.trim()
        ? { vendor: input.vendor.trim() }
        : {}),
    }),
    signal: input.signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    throw new ApiRequestError(
      payload?.message || payload?.error || messages.requestFailed,
      response.status,
    );
  }

  if (!response.body) {
    throw new ApiRequestError(messages.requestFailed, 500);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const consumeSseChunk = (chunk: string) => {
    const lines = chunk.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) {
        continue;
      }
      const raw = trimmed.slice(5).trim();
      if (!raw || raw === "[DONE]") {
        continue;
      }
      try {
        input.onEvent(JSON.parse(raw) as CanvasAgentChatSseEvent);
      } catch {
        // Ignore malformed SSE payloads.
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      consumeSseChunk(chunk);
    }
  }
  const tail = decoder.decode();
  if (tail) {
    buffer += tail;
  }
  // Flush trailing event if the stream closed without a final blank line.
  if (buffer.trim()) {
    consumeSseChunk(buffer);
    buffer = "";
  }
}

export type CanvasSkillSummary = {
  id: string;
  name: string;
  description: string;
  tags: string[];
};

export type CanvasSkillDetail = CanvasSkillSummary & {
  content: string;
  files: string[];
};

/** Skill catalog for the composer's "/" picker. */
export async function listCanvasSkills(): Promise<CanvasSkillSummary[]> {
  const payload = await portalRequest<{ skills: CanvasSkillSummary[] }>(
    "/portal/v1/agent/skills",
  );
  return payload.skills;
}

/** Full SKILL.md text, loaded when the user picks a skill. */
export async function readCanvasSkill(
  name: string,
): Promise<CanvasSkillDetail> {
  return portalRequest<CanvasSkillDetail>(
    `/portal/v1/agent/skills?name=${encodeURIComponent(name)}`,
  );
}
