import type {
  CanvasGraph,
  CanvasGraphNode,
  CanvasMediaReference,
  CanvasNodeData,
} from "@/lib/tu-shared-browser";
import {
  buildImageRequestBody,
  DEFAULT_IMAGE_PARAMS,
  sanitizeImageParams,
  toImagePlaygroundModel,
  type PlaygroundImageParams,
} from "@canvase/generation-params/image";
import type { ModelIdentity } from "@canvase/generation-params/model-families";
import {
  buildVideoRequestBody,
  DEFAULT_VIDEO_PARAMS,
  getVideoCapabilityProfile,
  resolveVideoReferenceMode,
  resolveVideoSanitizeMediaFlags,
  sanitizeVideoParams,
  type PlaygroundVideoParams,
} from "@canvase/generation-params/video";
import { portalRequest } from "@/lib/api";
import {
  canvasAssetsFromTask,
  withGeneratedAssets,
  type PortalTaskAssetDetail,
} from "@/lib/canvas/canvas-assets";
import { resolveByokConnection } from "@/lib/generation/byok-store";
import { runWithPlaygroundAuthRetry } from "@/lib/playground-api-key";
import {
  chatResponseText,
  generateChat,
  generateImage,
  generateVideo,
  type V1GenerationConnection,
  type V1GenerationResponse,
} from "@/lib/v1-client";
import { messages } from "@/messages";

export type CanvasRunUpdate = (
  nodeId: string,
  patch: Partial<CanvasNodeData>,
) => void;

function findNode(graph: CanvasGraph, nodeId: string): CanvasGraphNode | null {
  return graph.nodes.find((node) => node.id === nodeId) ?? null;
}

/** Pick BYOK profile from model catalog / node vendor; fall back to active. */
function generationConnectionForNode(
  node: CanvasGraphNode,
): V1GenerationConnection {
  if (typeof window === "undefined") {
    return {};
  }
  const modelId = node.data.model?.trim() ?? "";
  const connection = resolveByokConnection({
    // Catalog vendor wins over possibly stale node.data.vendor.
    modelId: modelId || undefined,
    vendor: node.data.vendor?.trim() || undefined,
  });
  return {
    ...(connection.baseUrl ? { baseUrl: connection.baseUrl } : {}),
    ...(connection.vendorId ? { vendorId: connection.vendorId } : {}),
    ...(connection.apiKey ? { apiKey: connection.apiKey } : {}),
  };
}

function resolveNodeGeneration(
  node: CanvasGraphNode,
  override?: V1GenerationConnection,
): V1GenerationConnection {
  if (override && (override.baseUrl || override.apiKey || override.vendorId)) {
    return override;
  }
  return generationConnectionForNode(node);
}

/** Text nodes connected to prompt/context inputs, in edge order. */
export function collectCanvasPromptInputs(
  graph: CanvasGraph,
  nodeId: string,
): string[] {
  const textById = new Map(
    graph.nodes
      .filter((node) => node.type === "text")
      .map((node) => [node.id, node.data.text?.trim() ?? ""]),
  );
  return graph.edges
    .filter(
      (edge) =>
        edge.target === nodeId &&
        (edge.data?.role === "prompt" || edge.data?.role === "context"),
    )
    .sort((left, right) => (left.data?.order ?? 0) - (right.data?.order ?? 0))
    .map((edge) => textById.get(edge.source) ?? "")
    .filter(Boolean);
}

/**
 * Merge connected prompt text with the node's own prompt without duplicating
 * an upstream prompt that was auto-filled into the composer.
 */
export function composeCanvasPrompt(
  upstream: string[],
  localPrompt: string | undefined,
): string {
  const upstreamText = upstream
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n\n");
  const local = localPrompt?.trim() ?? "";
  if (!upstreamText) {
    return local;
  }
  if (!local) {
    return upstreamText;
  }
  return local.includes(upstreamText)
    ? local
    : `${upstreamText}\n\n${local}`;
}

/** Image node URLs connected to image inputs, in edge order. */
export function collectCanvasImageInputs(
  graph: CanvasGraph,
  nodeId: string,
): string[] {
  const urlById = new Map(
    graph.nodes
      .filter((node) => node.type === "image")
      .map((node) => [
        node.id,
        [...(node.data.urls ?? []), node.data.url ?? ""].filter(Boolean),
      ]),
  );
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const edge of graph.edges
    .filter(
      (item) =>
        item.target === nodeId &&
        (item.data?.role === "reference_image" ||
          item.data?.role === "first_frame" ||
          item.data?.role === "last_frame"),
    )
    .sort((left, right) => (left.data?.order ?? 0) - (right.data?.order ?? 0))) {
    for (const url of urlById.get(edge.source) ?? []) {
      if (!seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    }
  }
  return urls;
}

function collectCanvasMediaInputs(
  graph: CanvasGraph,
  nodeId: string,
  role: string,
  sourceType: "image" | "video" | "audio",
): string[] {
  const urlById = new Map(
    graph.nodes
      .filter((node) => node.type === sourceType)
      .map((node) => [
        node.id,
        [...(node.data.urls ?? []), node.data.url ?? ""].filter(Boolean),
      ]),
  );
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const edge of graph.edges
    .filter(
      (item) => item.target === nodeId && item.data?.role === role,
    )
    .sort((left, right) => (left.data?.order ?? 0) - (right.data?.order ?? 0))) {
    for (const url of urlById.get(edge.source) ?? []) {
      if (!seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    }
  }
  return urls;
}

function dedupe(urls: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    const trimmed = url?.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function responseUrl(response: V1GenerationResponse): string | null {
  if (response.url?.trim()) {
    return response.url.trim();
  }
  for (const item of response.data ?? []) {
    if (item.url?.trim()) {
      return item.url.trim();
    }
  }
  return null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : messages.canvas.generationFailed;
}

async function generatedAssets(
  taskId: string | undefined,
  fallbackUrl: string,
): Promise<{
  url: string;
  urls: string[];
  assetId?: string;
  assetIds?: string[];
}> {
  if (!taskId || typeof window === "undefined") {
    return { url: fallbackUrl, urls: [fallbackUrl] };
  }
  try {
    const detail = await portalRequest<PortalTaskAssetDetail>(
      `/portal/v1/tasks/${encodeURIComponent(taskId)}`,
    );
    return canvasAssetsFromTask(detail, fallbackUrl);
  } catch {
    return { url: fallbackUrl, urls: [fallbackUrl] };
  }
}

/**
 * P0 image execution: prompt from connected text nodes + node prompt,
 * references from connected image nodes, then poll `/v1` with the playground token.
 */
export async function runCanvasImageNode(options: {
  nodeId: string;
  graph: CanvasGraph;
  apiKey: string;
  onApiKeyChange?: (value: string) => void;
  update: CanvasRunUpdate;
  signal?: AbortSignal;
  generation?: V1GenerationConnection;
}): Promise<void> {
  const { nodeId, graph, apiKey, onApiKeyChange, update, signal } = options;
  const node = findNode(graph, nodeId);
  if (!node || node.type !== "image") {
    throw new Error(messages.canvas.notImageNode);
  }
  const model = node.data.model?.trim() ?? "";
  if (!model) {
    update(nodeId, {
      status: "failed",
      error: messages.canvas.modelRequired,
    });
    throw new Error(messages.canvas.modelRequired);
  }
  const prompt = composeCanvasPrompt(
    collectCanvasPromptInputs(graph, nodeId),
    node.data.prompt,
  );
  if (!prompt) {
    update(nodeId, {
      status: "failed",
      error: messages.canvas.promptRequired,
    });
    throw new Error(messages.canvas.promptRequired);
  }

  const imageModel = toImagePlaygroundModel({
    id: model,
    vendor: node.data.vendor,
  });
  const params: PlaygroundImageParams = sanitizeImageParams(imageModel, {
    ...DEFAULT_IMAGE_PARAMS,
    ...(node.data.params as Partial<PlaygroundImageParams> | undefined),
    async: true,
  });
  const storedImageReferences = (
    (node.data.references as CanvasMediaReference[] | undefined) ?? []
  )
    .filter((item) => item.mediaType === "image")
    .map((item) => item.url);
  const referenceImages = dedupe([
    ...collectCanvasImageInputs(graph, nodeId),
    ...storedImageReferences,
    ...((node.data.referenceUrls as string[] | undefined) ?? []),
  ]);
  const body = buildImageRequestBody(imageModel, params, {
    modelId: model,
    prompt,
    referenceImages,
  });
  body.async = true;

  update(nodeId, {
    status: "running",
    error: undefined,
    startedAt: Date.now(),
    finishedAt: undefined,
  });

  const generation = resolveNodeGeneration(node, options.generation);

  try {
    const response = await runWithPlaygroundAuthRetry(
      apiKey,
      (credential) => {
        onApiKeyChange?.(credential);
        return generateImage(credential, body, {
          signal,
          generation,
          onUpdate: (task) => {
            if (task.id) {
              update(nodeId, { requestId: task.id });
            }
          },
        });
      },
      onApiKeyChange,
    );

    const url = responseUrl(response);
    if (!url) {
      throw new Error(response.error ?? messages.canvas.upstreamNoImageUrl);
    }
    const assets = await generatedAssets(response.id, url);
    update(nodeId, {
      status: "succeeded",
      ...withGeneratedAssets({}, assets),
      history: appendNodeHistory(node.data.history, {
        url: assets.url,
        at: Date.now(),
        requestId: response.id,
        ...(model ? { model } : {}),
      }),
      requestId: response.id,
      error: undefined,
      finishedAt: Date.now(),
    });
  } catch (error) {
    update(nodeId, {
      status: "failed",
      error: errorMessage(error),
      finishedAt: Date.now(),
    });
    throw error;
  }
}

/** P4 text execution: non-streaming chat with connected text as context. */
export async function runCanvasTextNode(options: {
  nodeId: string;
  graph: CanvasGraph;
  apiKey: string;
  onApiKeyChange?: (value: string) => void;
  update: CanvasRunUpdate;
  signal?: AbortSignal;
  generation?: V1GenerationConnection;
}): Promise<void> {
  const { nodeId, graph, apiKey, onApiKeyChange, update, signal } = options;
  const node = findNode(graph, nodeId);
  if (!node || node.type !== "text") {
    throw new Error(messages.canvas.notTextNode);
  }
  const model = node.data.model?.trim() ?? "";
  if (!model) {
    update(nodeId, {
      status: "failed",
      error: messages.canvas.modelRequired,
    });
    throw new Error(messages.canvas.modelRequired);
  }
  const prompt = composeCanvasPrompt(
    collectCanvasPromptInputs(graph, nodeId),
    node.data.prompt?.trim() ? node.data.prompt : node.data.text,
  );
  if (!prompt) {
    update(nodeId, {
      status: "failed",
      error: messages.canvas.promptRequired,
    });
    throw new Error(messages.canvas.promptRequired);
  }
  const system = node.data.systemPrompt?.trim();
  const generation = resolveNodeGeneration(node, options.generation);
  update(nodeId, {
    status: "running",
    error: undefined,
    startedAt: Date.now(),
    finishedAt: undefined,
  });
  try {
    const response = await runWithPlaygroundAuthRetry(
      apiKey,
      (credential) => {
        onApiKeyChange?.(credential);
        return generateChat(
          credential,
          {
            model,
            messages: [
              ...(system ? [{ role: "system", content: system }] : []),
              { role: "user", content: prompt },
            ],
          },
          { signal, generation },
        );
      },
      onApiKeyChange,
    );
    const text = chatResponseText(response);
    if (!text) {
      throw new Error(messages.canvas.upstreamNoText);
    }
    update(nodeId, {
      status: "succeeded",
      text,
      requestId: response.id,
      error: undefined,
      finishedAt: Date.now(),
    });
  } catch (error) {
    update(nodeId, {
      status: "failed",
      error: errorMessage(error),
      finishedAt: Date.now(),
    });
    throw error;
  }
}

/** P0 video execution: prompt + connected/manual references -> `/v1/videos`. */
export async function runCanvasVideoNode(options: {
  nodeId: string;
  graph: CanvasGraph;
  apiKey: string;
  onApiKeyChange?: (value: string) => void;
  update: CanvasRunUpdate;
  signal?: AbortSignal;
  generation?: V1GenerationConnection;
}): Promise<void> {
  const { nodeId, graph, apiKey, onApiKeyChange, update, signal } = options;
  const node = findNode(graph, nodeId);
  if (!node || node.type !== "video") {
    throw new Error(messages.canvas.notVideoNode);
  }
  const model = node.data.model?.trim() ?? "";
  if (!model) {
    update(nodeId, {
      status: "failed",
      error: messages.canvas.modelRequired,
    });
    throw new Error(messages.canvas.modelRequired);
  }
  const prompt = composeCanvasPrompt(
    collectCanvasPromptInputs(graph, nodeId),
    node.data.prompt,
  );
  if (!prompt) {
    update(nodeId, {
      status: "failed",
      error: messages.canvas.promptRequired,
    });
    throw new Error(messages.canvas.promptRequired);
  }

  const modelIdentity: ModelIdentity = {
    id: model,
    vendor: node.data.vendor,
  };
  const profile = getVideoCapabilityProfile(modelIdentity);
  const params: PlaygroundVideoParams = {
    ...DEFAULT_VIDEO_PARAMS,
    ...(node.data.params as Partial<PlaygroundVideoParams> | undefined),
  };
  const manualReferences =
    (node.data.references as CanvasMediaReference[] | undefined) ?? [];
  const manualImages = dedupe(
    manualReferences
      .filter((item) => item.mediaType === "image")
      .map((item) => item.url),
  );
  const manualVideos = dedupe(
    manualReferences
      .filter((item) => item.mediaType === "video")
      .map((item) => item.url),
  );
  const manualAudios = dedupe(
    manualReferences
      .filter((item) => item.mediaType === "audio")
      .map((item) => item.url),
  );

  const connectedFirstFrame = collectCanvasMediaInputs(
    graph,
    nodeId,
    "first_frame",
    "image",
  )[0];
  const connectedLastFrame = collectCanvasMediaInputs(
    graph,
    nodeId,
    "last_frame",
    "image",
  )[0];
  const connectedReferenceImages = collectCanvasMediaInputs(
    graph,
    nodeId,
    "reference_image",
    "image",
  );
  const connectedReferenceVideos = collectCanvasMediaInputs(
    graph,
    nodeId,
    "reference_video",
    "video",
  );
  const connectedReferenceAudios = collectCanvasMediaInputs(
    graph,
    nodeId,
    "reference_audio",
    "audio",
  );

  const referenceMode = resolveVideoReferenceMode(
    profile,
    params.referenceMode,
  );
  let firstFrame: string | undefined;
  let lastFrame: string | undefined;
  let referenceImages: string[] = [];
  let referenceVideos: string[] = [];
  let referenceAudio: string[] = [];

  if (referenceMode === "frame") {
    firstFrame = connectedFirstFrame ?? manualImages[0];
    lastFrame = connectedLastFrame ?? manualImages[1];
  } else {
    referenceImages = dedupe([
      ...connectedReferenceImages,
      ...manualImages,
      connectedFirstFrame,
      connectedLastFrame,
    ]);
    referenceVideos = dedupe([
      ...connectedReferenceVideos,
      ...manualVideos,
    ]);
    referenceAudio = dedupe([
      ...connectedReferenceAudios,
      ...manualAudios,
    ]);
  }

  const hasFrame = Boolean(firstFrame || lastFrame);
  const hasReference =
    hasFrame ||
    referenceImages.length > 0 ||
    referenceVideos.length > 0 ||
    referenceAudio.length > 0;
  const safeParams = sanitizeVideoParams(
    modelIdentity,
    params,
    resolveVideoSanitizeMediaFlags(
      modelIdentity,
      params,
      hasReference,
    ),
  );
  const body = buildVideoRequestBody(modelIdentity, safeParams, {
    modelId: model,
    prompt,
    firstFrame,
    lastFrame,
    referenceImages,
    referenceVideos,
    referenceAudio,
  });

  const generation = resolveNodeGeneration(node, options.generation);

  update(nodeId, {
    status: "running",
    error: undefined,
    startedAt: Date.now(),
    finishedAt: undefined,
  });

  try {
    const response = await runWithPlaygroundAuthRetry(
      apiKey,
      (credential) => {
        onApiKeyChange?.(credential);
        return generateVideo(credential, body, {
          signal,
          generation,
          onUpdate: (task) => {
            if (task.id) {
              update(nodeId, { requestId: task.id });
            }
          },
        });
      },
      onApiKeyChange,
    );

    const url = responseUrl(response);
    if (!url) {
      throw new Error(response.error ?? messages.canvas.upstreamNoVideoUrl);
    }
    const assets = await generatedAssets(response.id, url);
    update(nodeId, {
      status: "succeeded",
      ...withGeneratedAssets({}, assets),
      history: appendNodeHistory(node.data.history, {
        url: assets.url,
        at: Date.now(),
        requestId: response.id,
        ...(model ? { model } : {}),
      }),
      requestId: response.id,
      error: undefined,
      finishedAt: Date.now(),
    });
  } catch (error) {
    update(nodeId, {
      status: "failed",
      error: errorMessage(error),
      finishedAt: Date.now(),
    });
    throw error;
  }
}

/** Keeps the last few results so a regeneration can be undone. */
// Kept small on purpose: the graph has a 512 KB write budget and every
// node carries its own list.
const MAX_NODE_HISTORY = 10;

function appendNodeHistory(
  previous: CanvasNodeData["history"] | undefined,
  entry: NonNullable<CanvasNodeData["history"]>[number],
): NonNullable<CanvasNodeData["history"]> {
  const list = [...(previous ?? []), entry];
  return list.slice(-MAX_NODE_HISTORY);
}
