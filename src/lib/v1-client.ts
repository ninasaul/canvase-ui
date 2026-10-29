import { apiBase } from "@/lib/api-base";
import { readResponseStream } from "@/components/docs/docs-api-playground-stream";
import {
  BYOK_API_KEY_HEADER,
  BYOK_BASE_HEADER,
  BYOK_VENDOR_HEADER,
  GENERATION_API_KEY_HEADER,
  GENERATION_BASE_HEADER,
  GENERATION_VENDOR_HEADER,
} from "@/lib/generation/byok-url";
import {
  readByokApiKey,
  readByokBaseUrl,
} from "@/lib/generation/byok-store";

import {
  imageWaitTimeoutMs,
  resolveVideoWaitTimeoutMs,
  videoTimeoutMaxMs,
} from "@/lib/tu-shared-browser";

export type V1TaskStatus = "queued" | "in_progress" | "completed" | "failed";

export type V1MediaItem = {
  url?: string;
  b64_json?: string;
  revised_prompt?: string | null;
};

export type V1GenerationResponse = {
  id?: string;
  object?: string;
  model?: string;
  status?: V1TaskStatus;
  progress?: number;
  error?: string | null;
  url?: string;
  created?: number;
  created_at?: number;
  completed_at?: number | null;
  data?: V1MediaItem[];
  usage?: Record<string, unknown>;
};

export class V1RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "V1RequestError";
  }
}

function buildUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${apiBase}${normalized}`;
}

function applyGenerationHeaders(
  headers: Headers,
  options?: { baseUrl?: string; apiKey?: string; vendorId?: string },
): void {
  if (typeof window === "undefined") {
    return;
  }
  const baseUrl = (options?.baseUrl ?? readByokBaseUrl())
    .trim()
    .replace(/\/$/, "");
  if (baseUrl) {
    headers.set(GENERATION_BASE_HEADER, baseUrl);
    headers.set(BYOK_BASE_HEADER, baseUrl);
  }
  const vendorId = (options?.vendorId ?? "").trim();
  if (vendorId) {
    headers.set(GENERATION_VENDOR_HEADER, vendorId);
    headers.set(BYOK_VENDOR_HEADER, vendorId);
  }
  const apiKey = (options?.apiKey ?? readByokApiKey()).trim();
  if (apiKey) {
    headers.set(GENERATION_API_KEY_HEADER, apiKey);
    headers.set(BYOK_API_KEY_HEADER, apiKey);
  }
}

function applyOptionalBearer(headers: Headers, apiKey: string): void {
  const trimmed = apiKey.trim();
  if (trimmed) {
    headers.set(GENERATION_API_KEY_HEADER, trimmed);
    headers.set(BYOK_API_KEY_HEADER, trimmed);
  }
}

export type V1GenerationConnection = {
  baseUrl?: string;
  apiKey?: string;
  vendorId?: string;
};

type V1RequestOptions = {
  intervalMs?: number;
  maxDurationMs?: number;
  signal?: AbortSignal;
  onUpdate?: (task: V1GenerationResponse) => void;
  /** When false, return after create (caller / background poller continues). */
  poll?: boolean;
  /** Per-request BYOK gateway override (vendor-routed canvas runs). */
  generation?: V1GenerationConnection;
};

function resolveRequestApiKey(
  apiKey: string,
  generation?: V1GenerationConnection,
): string {
  return (generation?.apiKey ?? apiKey).trim();
}

function applyRequestAuth(
  headers: Headers,
  apiKey: string,
  generation?: V1GenerationConnection,
): string {
  const resolvedApiKey = resolveRequestApiKey(apiKey, generation);
  applyOptionalBearer(headers, resolvedApiKey);
  applyGenerationHeaders(headers, {
    baseUrl: generation?.baseUrl,
    apiKey: resolvedApiKey || undefined,
    vendorId: generation?.vendorId,
  });
  return resolvedApiKey;
}

function appendFormField(form: FormData, key: string, value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }
  if (typeof value === "boolean") {
    form.append(key, value ? "true" : "false");
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && item.trim()) {
        form.append(key, item.trim());
      }
    }
    return;
  }
  form.append(key, String(value));
}

function appendFormFile(form: FormData, key: string, file: File): void {
  form.append(key, file, file.name);
}

export type VideoMultipartFiles = {
  firstFrame?: File;
  lastFrame?: File;
  referenceImages?: File[];
  referenceVideos?: File[];
  referenceAudio?: File[];
};

function hasVideoMultipartFiles(files: VideoMultipartFiles | undefined): boolean {
  if (!files) {
    return false;
  }
  return (
    Boolean(files.firstFrame) ||
    Boolean(files.lastFrame) ||
    (files.referenceImages?.length ?? 0) > 0 ||
    (files.referenceVideos?.length ?? 0) > 0 ||
    (files.referenceAudio?.length ?? 0) > 0
  );
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const body = payload as {
    message?: string | string[];
    error?: { message?: string };
  };
  if (Array.isArray(body.message)) {
    return body.message.join("；");
  }
  if (typeof body.message === "string" && body.message.trim()) {
    return body.message;
  }
  if (typeof body.error?.message === "string" && body.error.message.trim()) {
    return body.error.message;
  }
  return fallback;
}

export type V1ModelListResponse = {
  object: "list";
  data: Array<{
    id: string;
    object: "model";
    created: number;
    owned_by: string;
    display_name: string;
    vendor?: string;
    description?: string;
    capability: string;
    pricing?: {
      currency: string;
      unit: string;
      amount: string;
      input_amount?: string;
      output_amount?: string;
      size_multipliers?: Record<string, string>;
      price_table?: {
        mode: "per_second" | "per_resolution" | "fixed";
        rates: Record<string, Record<string, { customer: string }>>;
      };
    };
  }>;
};

export async function listV1Models(
  apiKey = "",
  query?: { capability?: string; owned_by?: string },
  options?: { baseUrl?: string; apiKey?: string; vendorId?: string },
): Promise<V1ModelListResponse["data"]> {
  const params = new URLSearchParams();
  if (query?.capability) {
    params.set("capability", query.capability);
  }
  if (query?.owned_by) {
    params.set("owned_by", query.owned_by);
  }
  const qs = params.toString();
  const path = qs ? `/v1/models?${qs}` : "/v1/models";
  const response = await v1Request<V1ModelListResponse>(
    path,
    options?.apiKey ?? apiKey,
    {
      baseUrl: options?.baseUrl,
      apiKey: options?.apiKey ?? apiKey,
      vendorId: options?.vendorId,
    },
  );
  return response.data;
}

export async function v1Request<T>(
  path: string,
  apiKey = "",
  init: RequestInit & {
    baseUrl?: string;
    apiKey?: string;
    vendorId?: string;
  } = {},
): Promise<T> {
  const {
    baseUrl: baseUrlOverride,
    apiKey: apiKeyOverride,
    vendorId: vendorIdOverride,
    ...requestInit
  } = init;
  const headers = new Headers(requestInit.headers);
  const resolvedApiKey = (apiKeyOverride ?? apiKey).trim();
  applyOptionalBearer(headers, resolvedApiKey);
  if (requestInit.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  applyGenerationHeaders(headers, {
    baseUrl: baseUrlOverride,
    apiKey: resolvedApiKey || undefined,
    vendorId: vendorIdOverride,
  });

  const response = await fetch(buildUrl(path), {
    ...requestInit,
    headers,
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text.trim()) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new V1RequestError(
      extractErrorMessage(payload, `HTTP ${response.status}`),
      response.status,
    );
  }

  return payload as T;
}

export function isAsyncTaskResponse(
  payload: V1GenerationResponse,
): payload is V1GenerationResponse & { id: string; status: V1TaskStatus } {
  return Boolean(payload.id && payload.status && !payload.data?.length);
}

export function isSyncImageResponse(
  payload: V1GenerationResponse,
): boolean {
  return Array.isArray(payload.data) && payload.data.length > 0;
}

const TERMINAL_STATUSES = new Set<V1TaskStatus>(["completed", "failed"]);

/** Default async task poll cadence (image / video). */
export const V1_TASK_POLL_INTERVAL_MS = 5000;
/**
 * Fallback when callers omit maxDurationMs.
 * Prefer {@link resolveVideoWaitTimeoutMs} / imageWaitTimeoutMs per task.
 */
export const V1_TASK_POLL_MAX_MS = videoTimeoutMaxMs;

function videoSecondsFromBody(body: Record<string, unknown>): number | undefined {
  const raw = body.duration ?? body.seconds;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  if (typeof raw === "string") {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return undefined;
}

function withDefaultPollMaxDurationMs(
  options: V1RequestOptions,
  maxDurationMs: number,
): V1RequestOptions {
  return {
    ...options,
    maxDurationMs: options.maxDurationMs ?? maxDurationMs,
  };
}

export class V1PollTimeoutError extends Error {
  constructor(message = "Task polling timed out") {
    super(message);
    this.name = "V1PollTimeoutError";
  }
}

export async function pollV1Task(
  pollPath: string,
  apiKey: string,
  options: {
    intervalMs?: number;
    maxDurationMs?: number;
    signal?: AbortSignal;
    onUpdate?: (task: V1GenerationResponse) => void;
    generation?: V1GenerationConnection;
  } = {},
): Promise<V1GenerationResponse> {
  const intervalMs = options.intervalMs ?? V1_TASK_POLL_INTERVAL_MS;
  const maxDurationMs = options.maxDurationMs ?? V1_TASK_POLL_MAX_MS;
  const startedAt = Date.now();
  const resolvedApiKey = resolveRequestApiKey(apiKey, options.generation);

  while (true) {
    if (options.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    if (Date.now() - startedAt >= maxDurationMs) {
      throw new V1PollTimeoutError();
    }

    const task = await v1Request<V1GenerationResponse>(pollPath, resolvedApiKey, {
      signal: options.signal,
      baseUrl: options.generation?.baseUrl,
      apiKey: resolvedApiKey || undefined,
      vendorId: options.generation?.vendorId,
    });
    options.onUpdate?.(task);

    const status = task.status;
    if (status && TERMINAL_STATUSES.has(status)) {
      return task;
    }

    const remainingMs = maxDurationMs - (Date.now() - startedAt);
    if (remainingMs <= 0) {
      throw new V1PollTimeoutError();
    }

    const waitMs = Math.min(intervalMs, remainingMs);
    await new Promise<void>((resolve, reject) => {
      const timer = globalThis.setTimeout(resolve, waitMs);
      const onAbort = () => {
        globalThis.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      };
      options.signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
}

export async function generateImage(
  apiKey: string,
  body: Record<string, unknown>,
  options: V1RequestOptions & {
    /** Reference images sent as multipart file streams (not base64). */
    imageFiles?: File[];
  } = {},
): Promise<V1GenerationResponse> {
  const imageFiles = options.imageFiles?.filter(Boolean) ?? [];
  const useMultipart = imageFiles.length > 0;

  let requestBody: BodyInit;
  const headers = new Headers();
  const resolvedApiKey = applyRequestAuth(headers, apiKey, options.generation);

  if (useMultipart) {
    const form = new FormData();
    const { image, images, ...rest } = body;

    for (const [key, value] of Object.entries(rest)) {
      if (value === undefined || value === null) {
        continue;
      }
      if (typeof value === "boolean") {
        form.append(key, value ? "true" : "false");
      } else {
        form.append(key, String(value));
      }
    }

    form.append("image", imageFiles[0]!, imageFiles[0]!.name);
    for (const file of imageFiles.slice(1)) {
      form.append("images", file, file.name);
    }

    if (typeof image === "string" && image.trim()) {
      form.append("images", image.trim());
    }
    if (Array.isArray(images)) {
      for (const item of images) {
        if (typeof item === "string" && item.trim()) {
          form.append("images", item.trim());
        }
      }
    }

    requestBody = form;
  } else {
    headers.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(buildUrl("/v1/images/generations"), {
    method: "POST",
    headers,
    body: requestBody,
    signal: options.signal,
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text.trim()) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new V1RequestError(
      extractErrorMessage(payload, `HTTP ${response.status}`),
      response.status,
    );
  }

  const parsed = payload as V1GenerationResponse;

  if (isSyncImageResponse(parsed)) {
    options.onUpdate?.(parsed);
    return parsed;
  }

  if (isAsyncTaskResponse(parsed)) {
    options.onUpdate?.(parsed);
    if (options.poll === false) {
      return parsed;
    }
    return pollV1Task(
      `/v1/images/${parsed.id}`,
      resolvedApiKey,
      withDefaultPollMaxDurationMs(
        { ...options, generation: options.generation },
        imageWaitTimeoutMs,
      ),
    );
  }

  // Id without status: still treat as accepted async task when present.
  if (typeof parsed.id === "string" && parsed.id.trim()) {
    options.onUpdate?.(parsed);
    if (options.poll === false) {
      return parsed;
    }
    return pollV1Task(
      `/v1/images/${parsed.id}`,
      resolvedApiKey,
      withDefaultPollMaxDurationMs(
        { ...options, generation: options.generation },
        imageWaitTimeoutMs,
      ),
    );
  }

  return parsed;
}

export async function generateVideo(
  apiKey: string,
  body: Record<string, unknown>,
  options: V1RequestOptions & {
    /** Reference media sent as multipart file streams (not base64 JSON). */
    mediaFiles?: VideoMultipartFiles;
  } = {},
): Promise<V1GenerationResponse> {
  const mediaFiles = options.mediaFiles;
  const useMultipart = hasVideoMultipartFiles(mediaFiles);
  const resolvedApiKey = resolveRequestApiKey(apiKey, options.generation);

  let response: Response;
  if (useMultipart) {
    const form = new FormData();
    const {
      first_frame,
      last_frame,
      reference_images,
      reference_videos,
      reference_audio,
      ...rest
    } = body;

    for (const [key, value] of Object.entries(rest)) {
      appendFormField(form, key, value);
    }

    if (mediaFiles?.firstFrame) {
      appendFormFile(form, "first_frame", mediaFiles.firstFrame);
    } else if (typeof first_frame === "string" && first_frame.trim()) {
      form.append("first_frame", first_frame.trim());
    }

    if (mediaFiles?.lastFrame) {
      appendFormFile(form, "last_frame", mediaFiles.lastFrame);
    } else if (typeof last_frame === "string" && last_frame.trim()) {
      form.append("last_frame", last_frame.trim());
    }

    for (const file of mediaFiles?.referenceImages ?? []) {
      appendFormFile(form, "reference_images", file);
    }
    appendFormField(form, "reference_images", reference_images);

    for (const file of mediaFiles?.referenceVideos ?? []) {
      appendFormFile(form, "reference_videos", file);
    }
    appendFormField(form, "reference_videos", reference_videos);

    for (const file of mediaFiles?.referenceAudio ?? []) {
      appendFormFile(form, "reference_audio", file);
    }
    appendFormField(form, "reference_audio", reference_audio);

    const multipartHeaders = new Headers();
    applyRequestAuth(multipartHeaders, apiKey, options.generation);
    response = await fetch(buildUrl("/v1/videos"), {
      method: "POST",
      headers: multipartHeaders,
      body: form,
      signal: options.signal,
    });
  } else {
    const jsonHeaders = new Headers({
      "Content-Type": "application/json",
    });
    applyRequestAuth(jsonHeaders, apiKey, options.generation);
    response = await fetch(buildUrl("/v1/videos"), {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(body),
      signal: options.signal,
    });
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text.trim()) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new V1RequestError(
      extractErrorMessage(payload, `HTTP ${response.status}`),
      response.status,
    );
  }

  const parsed = payload as V1GenerationResponse;

  if (parsed.id) {
    options.onUpdate?.(parsed);
    if (options.poll === false) {
      return parsed;
    }
    return pollV1Task(
      `/v1/videos/${parsed.id}`,
      resolvedApiKey,
      withDefaultPollMaxDurationMs(
        { ...options, generation: options.generation },
        resolveVideoWaitTimeoutMs(videoSecondsFromBody(body)),
      ),
    );
  }

  return parsed;
}

export async function streamChatCompletion(
  apiKey: string,
  body: Record<string, unknown>,
  options: {
    signal?: AbortSignal;
    onChunk: (accumulated: string) => void;
    generation?: V1GenerationConnection;
  },
): Promise<void> {
  const chatHeaders = new Headers({
    "Content-Type": "application/json",
  });
  applyRequestAuth(chatHeaders, apiKey, options.generation);
  const response = await fetch(buildUrl("/v1/chat/completions"), {
    method: "POST",
    headers: chatHeaders,
    body: JSON.stringify({ ...body, stream: true }),
    signal: options.signal,
  });

  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;
    if (text.trim()) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = text;
      }
    }
    throw new V1RequestError(
      extractErrorMessage(payload, `HTTP ${response.status}`),
      response.status,
    );
  }

  if (response.body) {
    let accumulated = "";
    await readResponseStream(
      response,
      (chunk) => {
        accumulated += chunk;
        options.onChunk(accumulated);
      },
      options.signal ?? new AbortController().signal,
    );
    return;
  }

  options.onChunk(await response.text());
}

export type V1ChatResponse = {
  id?: string;
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

export function chatResponseText(response: V1ChatResponse): string {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part.text === "string" ? part.text : "",
      )
      .join("")
      .trim();
  }
  return "";
}

/** Non-streaming chat completion used by canvas text nodes. */
export async function generateChat(
  apiKey: string,
  body: Record<string, unknown>,
  options: {
    signal?: AbortSignal;
    generation?: V1GenerationConnection;
  } = {},
): Promise<V1ChatResponse> {
  const resolvedApiKey = resolveRequestApiKey(apiKey, options.generation);
  return v1Request<V1ChatResponse>("/v1/chat/completions", resolvedApiKey, {
    method: "POST",
    body: JSON.stringify({ ...body, stream: false }),
    signal: options.signal,
    baseUrl: options.generation?.baseUrl,
    apiKey: resolvedApiKey || undefined,
    vendorId: options.generation?.vendorId,
  });
}
