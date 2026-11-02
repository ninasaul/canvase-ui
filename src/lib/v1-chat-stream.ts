import { apiBase } from "@/lib/api-base";
import {
  BYOK_API_KEY_HEADER,
  BYOK_BASE_HEADER,
  BYOK_VENDOR_HEADER,
  GENERATION_API_KEY_HEADER,
  GENERATION_BASE_HEADER,
  GENERATION_VENDOR_HEADER,
} from "@/lib/generation/byok-url";
import {
  V1RequestError,
  chatResponseText,
  type V1ChatResponse,
  type V1ChatToolCall,
  type V1GenerationConnection,
} from "@/lib/v1-client";

export type StreamGenerateChatResult = {
  content: string;
  toolCalls: V1ChatToolCall[];
  finishReason: string | null;
};

type StreamToolCallDelta = {
  index?: number;
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
};

type StreamChatChunk = {
  choices?: Array<{
    delta?: {
      content?: string | Array<{ type?: string; text?: string }> | null;
      tool_calls?: StreamToolCallDelta[];
    };
    finish_reason?: string | null;
  }>;
  error?: { message?: string };
};

function resolveAppOrigin(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "";
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  return "http://127.0.0.1:3917";
}

function buildUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (apiBase) {
    return `${apiBase.replace(/\/$/, "")}${normalized}`;
  }
  if (typeof window === "undefined") {
    return `${resolveAppOrigin()}${normalized}`;
  }
  return normalized;
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

function applyChatAuth(
  headers: Headers,
  apiKey: string,
  generation?: V1GenerationConnection,
): void {
  const resolvedApiKey = (generation?.apiKey ?? apiKey).trim();
  if (resolvedApiKey) {
    headers.set(GENERATION_API_KEY_HEADER, resolvedApiKey);
    headers.set(BYOK_API_KEY_HEADER, resolvedApiKey);
    // Server-side callers reach the gateway directly (no /v1 proxy), so the
    // key must also travel as a real Authorization header.
    if (typeof window === "undefined") {
      headers.set("Authorization", `Bearer ${resolvedApiKey}`);
    }
  }
  const baseUrl = (generation?.baseUrl ?? "").trim().replace(/\/$/, "");
  if (baseUrl) {
    headers.set(GENERATION_BASE_HEADER, baseUrl);
    headers.set(BYOK_BASE_HEADER, baseUrl);
  }
  const vendorId = (generation?.vendorId ?? "").trim();
  if (vendorId) {
    headers.set(GENERATION_VENDOR_HEADER, vendorId);
    headers.set(BYOK_VENDOR_HEADER, vendorId);
  }
}

function streamDeltaText(
  content:
    | string
    | Array<{ type?: string; text?: string }>
    | null
    | undefined,
): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("");
  }
  return "";
}

/**
 * OpenAI-compatible chat streaming with tool_calls accumulation.
 * Kept outside v1-client to avoid app-route circular import with canvas-runner.
 * onTextDelta receives incremental content pieces (not the full string).
 */
export async function streamGenerateChat(
  apiKey: string,
  body: Record<string, unknown>,
  options: {
    signal?: AbortSignal;
    generation?: V1GenerationConnection;
    onTextDelta?: (delta: string) => void;
  } = {},
): Promise<StreamGenerateChatResult> {
  const chatHeaders = new Headers({
    "Content-Type": "application/json",
  });
  applyChatAuth(chatHeaders, apiKey, options.generation);
  const upstreamBase = (options.generation?.baseUrl ?? "")
    .trim()
    .replace(/\/$/, "");
  // Server callers know the gateway; skip the app's own /v1 proxy.
  const url =
    typeof window === "undefined" && upstreamBase
      ? `${upstreamBase}/v1/chat/completions`
      : buildUrl("/v1/chat/completions");
  const response = await fetch(url, {
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

  if (!response.body) {
    throw new V1RequestError("Empty stream body", 500);
  }

  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as V1ChatResponse;
    if (payload && typeof payload === "object" && "error" in payload) {
      throw new V1RequestError(
        extractErrorMessage(payload, "Chat completion failed"),
        500,
      );
    }
    const text = chatResponseText(payload);
    if (text) {
      options.onTextDelta?.(text);
    }
    const toolCalls = payload.choices?.[0]?.message?.tool_calls;
    return {
      content: text,
      toolCalls: Array.isArray(toolCalls) ? toolCalls : [],
      finishReason: payload.choices?.[0]?.finish_reason ?? null,
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let preamble = "";
  let sawSseData = false;
  let content = "";
  let finishReason: string | null = null;
  const toolCallsByIndex = new Map<
    number,
    {
      id: string;
      type: string;
      function: { name: string; arguments: string };
    }
  >();

  const consumeDataPayload = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "[DONE]") {
      return;
    }
    let chunk: StreamChatChunk;
    try {
      chunk = JSON.parse(trimmed) as StreamChatChunk;
    } catch {
      return;
    }
    sawSseData = true;
    if (chunk.error?.message) {
      throw new V1RequestError(chunk.error.message, 500);
    }
    const choice = chunk.choices?.[0];
    if (!choice) {
      return;
    }
    if (choice.finish_reason) {
      finishReason = choice.finish_reason;
    }
    const deltaText = streamDeltaText(choice.delta?.content);
    if (deltaText) {
      content += deltaText;
      options.onTextDelta?.(deltaText);
    }
    const toolDeltas = choice.delta?.tool_calls;
    if (!Array.isArray(toolDeltas)) {
      return;
    }
    for (const toolDelta of toolDeltas) {
      const index =
        typeof toolDelta.index === "number" && Number.isFinite(toolDelta.index)
          ? toolDelta.index
          : 0;
      const current = toolCallsByIndex.get(index) ?? {
        id: "",
        type: "function",
        function: { name: "", arguments: "" },
      };
      if (toolDelta.id) {
        current.id = toolDelta.id;
      }
      if (toolDelta.type) {
        current.type = toolDelta.type;
      }
      if (toolDelta.function?.name) {
        current.function.name += toolDelta.function.name;
      }
      if (typeof toolDelta.function?.arguments === "string") {
        current.function.arguments += toolDelta.function.arguments;
      }
      toolCallsByIndex.set(index, current);
    }
  };

  try {
    while (true) {
      if (options.signal?.aborted) {
        await reader.cancel();
        break;
      }
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmedLine = line.trimEnd();
        if (!trimmedLine.startsWith("data:")) {
          if (!sawSseData) {
            preamble += `${trimmedLine}\n`;
          }
          continue;
        }
        consumeDataPayload(trimmedLine.slice(5).trimStart());
      }
    }
    const tail = decoder.decode();
    if (tail) {
      buffer += tail;
    }
    if (buffer.trim()) {
      for (const line of buffer.split("\n")) {
        const trimmedLine = line.trimEnd();
        if (!trimmedLine.startsWith("data:")) {
          if (!sawSseData) {
            preamble += `${trimmedLine}\n`;
          }
          continue;
        }
        consumeDataPayload(trimmedLine.slice(5).trimStart());
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!sawSseData) {
    const raw = `${preamble}${buffer}`.trim();
    if (raw.startsWith("{")) {
      let payload: V1ChatResponse;
      try {
        payload = JSON.parse(raw) as V1ChatResponse;
      } catch {
        throw new V1RequestError("Invalid chat stream payload", 500);
      }
      const text = chatResponseText(payload);
      if (text) {
        options.onTextDelta?.(text);
      }
      const toolCalls = payload.choices?.[0]?.message?.tool_calls;
      return {
        content: text,
        toolCalls: Array.isArray(toolCalls) ? toolCalls : [],
        finishReason: payload.choices?.[0]?.finish_reason ?? null,
      };
    }
  }

  const toolCalls: V1ChatToolCall[] = [...toolCallsByIndex.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, call]) => ({
      id: call.id || undefined,
      type: call.type || "function",
      function: {
        name: call.function.name || undefined,
        arguments: call.function.arguments || undefined,
      },
    }));

  return {
    content,
    toolCalls,
    finishReason,
  };
}
