import {
  resolveAgentChatAttachments,
  type ResolvedAgentChatAttachment,
} from "@/lib/agent/canvas-agent-media";
import {
  AGENT_TOOL_NAMES,
  canvasToolSchemas,
  executeCanvasTool,
  isAgentToolName,
  isCanvasToolName,
  type CanvasToolName,
} from "@/lib/agent/canvas-tools";
import {
  evaluateToolApproval,
  grantSessionTool,
  requestApproval,
} from "@/lib/agent/canvas-approvals";
import {
  buildCanvasAgentContextLines,
  type CanvasAgentContextInput,
} from "@/lib/agent/canvas-agent-context";
import {
  beginAgentTurn,
  drainSteers,
  endAgentTurn,
} from "@/lib/agent/canvas-steering";
import { loadSkillCatalog, type CanvasSkill } from "@/lib/agent/skills";
import { parseCanvasGraph } from "@/lib/canvas/canvas-graph";
import { prisma } from "@/lib/prisma";
import { CanvasUpdateError } from "@/lib/canvas/apply-canvas-graph-update";
import { resolveUserGenerationConnection } from "@/lib/generation/generation-config-server";
import {
  getChatMediaCapabilityProfile,
  type ChatMediaCapabilityProfile,
  type ChatMediaKind,
} from "@/lib/playground/chat-capabilities";
import { streamGenerateChat } from "@/lib/v1-chat-stream";
import type { V1ChatToolCall } from "@/lib/v1-client";

/**
 * Soft step budget for one turn (one user send), aligned with DeepSeek Harness:
 * turn = drain one user input; step = one model call + its tools.
 * Hitting this pauses the turn for optional Continue — never ends the session.
 */
export const CANVAS_AGENT_CHAT_SOFT_STEP_BUDGET = 64;

export type CanvasAgentChatRole = "user" | "assistant" | "tool" | "system";

export type CanvasAgentChatMediaKind = ChatMediaKind;

export type CanvasAgentChatAttachment = {
  url: string;
  kind?: CanvasAgentChatMediaKind;
};

/** @deprecated Prefer attachments with kind. Treated as image. */
export type CanvasAgentChatImage = {
  url: string;
};

export type CanvasAgentChatMessage = {
  role: CanvasAgentChatRole;
  content: string;
  attachments?: CanvasAgentChatAttachment[];
  /** @deprecated Prefer attachments. */
  images?: CanvasAgentChatImage[];
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
  /** A spend / destructive tool is waiting for a human decision. */
  | {
      type: "approval_request";
      id: string;
      tool: string;
      summary: string;
      details?: Record<string, unknown>;
    }
  | { type: "approval_resolved"; id: string; decision: string }
  /** A mid-turn instruction was folded into the conversation. */
  | { type: "steer_applied"; id: string; text: string }
  /** Soft pause after step budget; UI may offer Continue. Never an Agent error. */
  | { type: "step_budget" }
  | { type: "error"; message: string }
  | { type: "done" };

const GRAPH_MUTATE_TOOLS = new Set<CanvasToolName>([
  "canvas_add_node",
  "canvas_update_node",
  "canvas_delete_nodes",
  "canvas_connect",
  "canvas_disconnect",
  "canvas_set_selection",
  "canvas_run",
  "canvas_run_cancel",
]);

export function isGraphMutateTool(tool: string): boolean {
  return isCanvasToolName(tool) && GRAPH_MUTATE_TOOLS.has(tool);
}

function formatSkillCatalog(skills: CanvasSkill[]): string[] {
  if (skills.length === 0) {
    return [];
  }
  return [
    "Available skills (reusable instructions for non-trivial tasks):",
    ...skills.map((skill) => {
      const tags = skill.tags.length > 0 ? ` [${skill.tags.join(", ")}]` : "";
      return `- ${skill.id}${tags}: ${skill.description || skill.name}`;
    }),
    "Call skills_list for the catalog and skills_read({ name }) before improvising a workflow. Follow the skill's instructions; read listed resource files only when needed.",
  ];
}

export function buildCanvasAgentSystemPrompt(
  canvasId: string,
  skills: CanvasSkill[] = [],
  contextLines: string[] = [],
): string {
  return [
    "You are the Canvase canvas agent. You help the user inspect and edit one canvas graph, and can start generation runs.",
    `Target canvas id: ${canvasId}.`,
    ...(contextLines.length > 0
      ? [
          ...contextLines,
          "The context block above is rebuilt every turn — trust it for ids, counts and the user's selection. Do not call canvas_get just to learn the state.",
        ]
      : ["Call canvas_get first in a session to learn the current version and node ids."]),
    "Every edit tool requires expectedVersion from the latest canvas_get / edit response. On version conflict, canvas_get again and retry.",
    "Prefer small, reversible edits. Confirm destructive deletes briefly in text when unsure.",
    "Use canvas_run only when the user explicitly asks to generate; modes are all | selected | node | from | retry-failed (`node` runs only the selected nodes, skipping upstream; selecting a group node expands to its children). Poll canvas_run_status only while the user asks about progress.",
    "Generation belongs to the user. You never start a run on your own initiative, and a failed run is an upstream/model outcome, not something you are accountable for: report the facts once (which nodes failed, the error text) and let the user decide what to do next.",
    "When the user declines a run or an edit, stop and wait for their instruction. Do not re-propose the same action in the same turn, and do not narrate the refusal more than once.",
    "Say each thing once. Do not reopen completed work, re-state the canvas status, or repeat a previous explanation unless the user asks again or something changed.",
    "Do not invent asset URLs. For new empty media nodes, leave url empty unless the user provides one.",
    "Grouping: use canvas_group_nodes to wrap existing root nodes (it computes the bounding box and reparents them); use canvas_ungroup to dissolve. Nodes inside a group use group-relative positions.",
    "Generation params: call canvas_generation_options before changing data.params — it returns the model\'s allowed values. params keys are merged, so partial updates are safe.",
    "The user may attach image / video / audio. Images are sent as OpenAI-compatible content parts: { type: image_url, image_url: { url: data:... } } (inlined), because upstream often cannot download our CDN.",
    "Public https URLs are also listed in the text — use those exact URLs when adding or updating canvas media nodes. If there is no image_url part, treat listed URLs as canvas asset links only.",
    ...formatSkillCatalog(skills),
    "Reply in the user's language. Keep tool chatter short; explain what you changed after tools finish.",
  ].join("\n");
}

function normalizeMessageAttachments(
  message: CanvasAgentChatMessage,
): CanvasAgentChatAttachment[] {
  if (message.attachments && message.attachments.length > 0) {
    return message.attachments
      .map((item) => ({
        url: item.url.trim(),
        kind: item.kind ?? ("image" as CanvasAgentChatMediaKind),
      }))
      .filter((item) => item.url.length > 0);
  }
  if (message.images && message.images.length > 0) {
    return message.images
      .map((item) => ({
        url: item.url.trim(),
        kind: "image" as CanvasAgentChatMediaKind,
      }))
      .filter((item) => item.url.length > 0);
  }
  return [];
}

/**
 * OpenAI-compatible multimodal part.
 * Always prefer inlined data: URLs — upstream (DeepSeek etc.) often cannot
 * download private / hotlink-protected CDNs like o.tokenmei.com.
 * Never send bare http(s) image_url unless it is already a data URL.
 */
function mediaPartForAttachment(
  kind: CanvasAgentChatMediaKind,
  attachment: ResolvedAgentChatAttachment,
  profile: ChatMediaCapabilityProfile,
): Record<string, unknown> | null {
  const modelUrl = attachment.modelUrl.trim();
  if (!modelUrl.startsWith("data:") || !attachment.inlined) {
    return null;
  }
  if (kind === "image" && profile.supportsImages) {
    return { type: "image_url", image_url: { url: modelUrl } };
  }
  if (kind === "video" && profile.supportsVideos) {
    return { type: "video_url", video_url: { url: modelUrl } };
  }
  if (kind === "audio" && profile.supportsAudio) {
    return { type: "audio_url", audio_url: { url: modelUrl } };
  }
  return null;
}

/**
 * Drops image/video/audio parts, keeping the text and the URL catalog. Used
 * when an upstream rejects multimodal content: the turn still runs, and the
 * model can reference the attachments by URL through canvas tools.
 */
function stripMediaParts(
  thread: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return thread.map((message) => {
    if (!Array.isArray(message.content)) {
      return message;
    }
    const text = (message.content as Array<Record<string, unknown>>)
      .filter((part) => part.type === "text")
      .map((part) => String(part.text ?? ""))
      .join("\n")
      .trim();
    return { ...message, content: text };
  });
}

function looksLikeMediaRejection(message: string): boolean {
  return /image|vision|multimodal|content|media|type.*not.*support|unsupported/i.test(
    message,
  );
}

function toOpenAiUserContent(
  text: string,
  attachments: ResolvedAgentChatAttachment[],
  profile: ChatMediaCapabilityProfile,
): string | Array<Record<string, unknown>> {
  const trimmed = text.trim();
  const media = attachments.slice(0, profile.maxAttachments);
  const catalogLines: string[] = [];
  const multimodalParts: Array<Record<string, unknown>> = [];

  for (const item of media) {
    const kind = item.kind ?? "image";
    const publicUrl = item.url.trim();
    if (!publicUrl) {
      continue;
    }
    catalogLines.push(
      item.inlined
        ? `- ${kind}: ${publicUrl}`
        : `- ${kind}: ${publicUrl} (could not be delivered to the model; ${item.skipNote ?? "not inlined"})`,
    );
    const part = mediaPartForAttachment(kind, item, profile);
    if (part) {
      multimodalParts.push(part);
    }
  }

  // Match OpenAI / DeepSeek vision shape:
  // content: [{ type: "text", text }, { type: "image_url", image_url: { url } }, ...]
  if (multimodalParts.length === 0) {
    const catalog =
      catalogLines.length > 0
        ? `Attached media (use these public URLs when adding canvas nodes):\n${catalogLines.join("\n")}`
        : "";
    return [trimmed, catalog].filter(Boolean).join("\n\n");
  }

  const textForModel =
    trimmed ||
    (catalogLines.length > 0
      ? "Please inspect the attached media."
      : "");
  const canvasHint =
    catalogLines.length > 0
      ? `\n\nAttached media URLs for canvas tools:\n${catalogLines.join("\n")}`
      : "";
  const parts: Array<Record<string, unknown>> = [
    { type: "text", text: `${textForModel}${canvasHint}`.trim() },
    ...multimodalParts,
  ];
  return parts;
}

export function canvasToolsAsOpenAiTools(): Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> {
  return AGENT_TOOL_NAMES.map((name) => {
    const schema = canvasToolSchemas[name];
    return {
      type: "function" as const,
      function: {
        name,
        description: schema.description,
        parameters: schema.inputSchema,
      },
    };
  });
}

/**
 * Result budget per tool. Reads must fit in the model's context (a canvas
 * summary is tens of KB); write confirmations stay tiny. Truncating reads to a
 * flat 400 chars hid the node list, so the model re-called the same tool
 * forever — the exact loop this table exists to prevent.
 */
const TOOL_RESULT_LIMITS: Record<string, number> = {
  canvas_get: 24_000,
  canvas_get_node: 8_000,
  canvas_search_nodes: 8_000,
  canvas_run_status: 8_000,
  canvas_run_snapshot: 8_000,
  canvas_generation_options: 2_000,
  skills_list: 8_000,
  skills_read: 24_000,
};
const DEFAULT_TOOL_RESULT_LIMIT = 400;

function summarizeToolResult(tool: string, result: unknown): string {
  const limit = TOOL_RESULT_LIMITS[tool] ?? DEFAULT_TOOL_RESULT_LIMIT;
  let text: string;
  try {
    text = JSON.stringify(result) ?? String(result);
  } catch {
    text = String(result);
  }
  if (text.length <= limit) {
    return text;
  }
  return (
    `${text.slice(0, limit)}\n` +
    `[truncated: ${text.length} chars total, showing ${limit}. ` +
    `Call again with a narrower scope (canvas_search_nodes with labelIncludes, ` +
    `canvas_get_node with nodeId, or canvas_generation_options with nodeId) ` +
    `instead of repeating this call.]`
  );
}

function parseToolArgs(raw: string | undefined): unknown {
  if (!raw?.trim()) {
    return {};
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
}

/** Fresh canvas digest for this turn; empty when the canvas is gone. */
async function loadCanvasContextLines(input: {
  canvasId: string;
  ownerId: string;
  context?: CanvasAgentContextInput | null;
}): Promise<string[]> {
  const row = await prisma.canvas
    .findFirst({
      where: { id: input.canvasId, ownerId: input.ownerId },
      select: { title: true, version: true, graph: true },
    })
    .catch(() => null);
  if (!row) {
    return [];
  }
  try {
    return buildCanvasAgentContextLines({
      title: row.title,
      version: row.version,
      graph: parseCanvasGraph(row.graph),
      context: input.context,
    });
  } catch {
    return [];
  }
}

/**
 * Ask the human before a spend / bulk-destructive tool runs.
 * Returns a denial summary when the action must not execute, else null.
 */
/**
 * (tool, args) pairs the user already denied, with the time of the denial.
 * Used as guidance for the model ("the user refused this at 15:23"), never as
 * a lock: the user is free to approve the same action later.
 */
const deniedToolCalls = new Map<string, number>();

function deniedCallKey(input: {
  canvasId: string;
  sessionId?: string;
  tool: string;
  args: unknown;
}): string {
  return `${input.canvasId}:${input.sessionId ?? "-"}:${input.tool}:${JSON.stringify(
    input.args ?? {},
  )}`;
}

async function gateToolApproval(input: {
  tool: string;
  args: unknown;
  canvasId: string;
  ownerId: string;
  sessionId?: string;
  signal?: AbortSignal;
  emit: (event: CanvasAgentChatSseEvent) => void;
}): Promise<string | null> {
  const args =
    input.args && typeof input.args === "object"
      ? (input.args as Record<string, unknown>)
      : {};
  // P0-3: the user already said no to this exact action. Do not pop the card
  // again; tell the model to propose something else.
  const denyKey = deniedCallKey({
    canvasId: input.canvasId,
    sessionId: input.sessionId,
    tool: input.tool,
    args,
  });
  // User intent wins: a previous denial is a hint for the model, never a lock.
  // The card is shown again if the model asks again.

  const check = await evaluateToolApproval({
    ownerId: input.ownerId,
    canvasId: input.canvasId,
    sessionId: input.sessionId,
    tool: input.tool,
    args,
  });
  if (!check.required) {
    return null;
  }

  const { id, decision } = await requestApproval({
    ownerId: input.ownerId,
    canvasId: input.canvasId,
    sessionId: input.sessionId,
    tool: input.tool,
    signal: input.signal,
  });
  input.emit({
    type: "approval_request",
    id,
    tool: input.tool,
    summary: check.summary,
    details: check.details,
  });

  const answer = await decision;
  input.emit({ type: "approval_resolved", id, decision: answer });

  if (answer === "deny") {
    // Keep the timestamp so the model can be told it was already refused, but
    // do not block a later ask — the user decides.
    deniedToolCalls.set(denyKey, Date.now());
    return "用户拒绝了这次操作。请说明原因，或提出一个更小的替代方案（例如只运行选中的那个节点）。";
  }
  if (answer === "allow_session") {
    await grantSessionTool({
      canvasId: input.canvasId,
      sessionId: input.sessionId,
      tool: input.tool,
    });
  }
  return null;
}

export async function runCanvasAgentChat(input: {
  canvasId: string;
  ownerId: string;
  /** Conversation boundary; used for session-wide approvals. */
  sessionId?: string;
  /** What the user is looking at right now (selection / focus / viewport). */
  context?: CanvasAgentContextInput | null;
  messages: CanvasAgentChatMessage[];
  model?: string;
  vendor?: string;
  signal?: AbortSignal;
  emit: (event: CanvasAgentChatSseEvent) => void;
}): Promise<void> {
  const model = input.model?.trim() ?? "";
  if (!model) {
    input.emit({ type: "error", message: "Chat model is required" });
    input.emit({ type: "done" });
    return;
  }

  const connection = await resolveUserGenerationConnection(input.ownerId, {
    vendorId: input.vendor,
    modelId: model,
  });
  if (!connection.baseUrl && !connection.apiKey) {
    input.emit({
      type: "error",
      message: "Chat generation is not configured",
    });
    input.emit({ type: "done" });
    return;
  }

  const generation = {
    baseUrl: connection.baseUrl || undefined,
    apiKey: connection.apiKey || undefined,
    vendorId: connection.vendorId || undefined,
  };
  const mediaProfile = getChatMediaCapabilityProfile(model, input.vendor);
  const tools = canvasToolsAsOpenAiTools();
  const skills = await loadSkillCatalog().catch(() => []);
  const contextLines = await loadCanvasContextLines(input);
  const thread: Array<Record<string, unknown>> = [
    {
      role: "system",
      content: buildCanvasAgentSystemPrompt(
        input.canvasId,
        skills,
        contextLines,
      ),
    },
  ];
  let lastUserMessageIndex = -1;
  for (let index = 0; index < input.messages.length; index += 1) {
    if (input.messages[index]?.role === "user") {
      lastUserMessageIndex = index;
    }
  }
  for (let index = 0; index < input.messages.length; index += 1) {
    const item = input.messages[index];
    if (!item) {
      continue;
    }
    if (item.role === "assistant") {
      const content = item.content.trim();
      if (content) {
        thread.push({ role: "assistant", content });
      }
      continue;
    }
    if (item.role === "user") {
      const attachments = normalizeMessageAttachments(item);
      const content = item.content.trim();
      if (!content && attachments.length === 0) {
        continue;
      }
      const resolvedAttachments =
        attachments.length > 0
          ? await resolveAgentChatAttachments({
              ownerId: input.ownerId,
              attachments,
              profile: mediaProfile,
              // Only the latest user turn is inlined; history stays URL-only.
              inline: index === lastUserMessageIndex,
            })
          : [];
      thread.push({
        role: "user",
        content: toOpenAiUserContent(
          content,
          resolvedAttachments,
          mediaProfile,
        ),
      });
    }
  }

  if (thread.length <= 1) {
    input.emit({
      type: "error",
      message: "No user message to process",
    });
    input.emit({ type: "done" });
    return;
  }

  // Steering: a turn stays steerable until it ends, so the user can add
  // guidance while the agent is mid-flight (applied at the next step).
  const turnKey = await beginAgentTurn({
    canvasId: input.canvasId,
    sessionId: input.sessionId,
  });
  const applySteers = async () => {
    const steers = await drainSteers(turnKey);
    for (const steer of steers) {
      thread.push({
        role: "user",
        content: `[mid-turn instruction from the user] ${steer.content}`,
      });
      input.emit({
        type: "steer_applied",
        id: steer.id,
        text: steer.content,
      });
    }
    return steers.length;
  };

  // Primary exits (harness-like): model stops tools, or caller aborts.
  // Soft step budget only pauses the turn for Continue — never errors the session.
  // Per-turn memory of identical tool calls (P0-2).
  const callsSeen = new Map<string, number>();
  // One multimodal → text-only retry per turn.
  let mediaFallbackUsed = false;
  try {
  for (
    let step = 0;
    step < CANVAS_AGENT_CHAT_SOFT_STEP_BUDGET;
    step += 1
  ) {
    if (input.signal?.aborted) {
      input.emit({ type: "done" });
      return;
    }

    // Guidance sent while the previous step was streaming applies here.
    await applySteers();

    let text = "";
    let toolCalls: V1ChatToolCall[] = [];
    try {
      const streamed = await streamGenerateChat(
        connection.apiKey,
        {
          model,
          messages: thread,
          tools,
          tool_choice: "auto",
        },
        {
          signal: input.signal,
          generation,
          onTextDelta: (delta) => {
            if (!delta || input.signal?.aborted) {
              return;
            }
            input.emit({ type: "text_delta", text: delta });
          },
        },
      );
      text = streamed.content.trim();
      toolCalls = streamed.toolCalls;
    } catch (error) {
      if (input.signal?.aborted) {
        input.emit({ type: "done" });
        return;
      }
      const message =
        error instanceof Error ? error.message : "Chat completion failed";
      const hasMedia = thread.some((entry) => Array.isArray(entry.content));
      if (!mediaFallbackUsed && hasMedia && looksLikeMediaRejection(message)) {
        // The upstream cannot take image/audio parts: retry the same step with
        // text only, so the attachment still shows up as a URL for canvas tools.
        mediaFallbackUsed = true;
        thread.splice(0, thread.length, ...stripMediaParts(thread));
        continue;
      }
      input.emit({ type: "error", message });
      input.emit({ type: "done" });
      return;
    }

    if (toolCalls.length === 0) {
      if (text) {
        thread.push({ role: "assistant", content: text });
      }
      // A message that arrived during this stream still deserves an answer.
      if ((await applySteers()) > 0) {
        continue;
      }
      if (!text && step === 0) {
        // Upstream returned nothing usable — surface it so the UI is not blank.
        input.emit({
          type: "text_delta",
          text: "Model returned an empty response. Please try again.",
        });
      }
      input.emit({ type: "done" });
      return;
    }

    thread.push({
      role: "assistant",
      content: text || null,
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      if (input.signal?.aborted) {
        input.emit({ type: "done" });
        return;
      }

      const toolName = call.function?.name?.trim() ?? "";
      const callId = call.id?.trim() || `call_${crypto.randomUUID()}`;
      const args = parseToolArgs(call.function?.arguments);

      input.emit({
        type: "tool_start",
        tool: toolName,
        id: callId,
        args,
      });

      if (!isAgentToolName(toolName)) {
        const summary = `Unknown tool: ${toolName}`;
        input.emit({
          type: "tool_result",
          tool: toolName,
          id: callId,
          ok: false,
          summary,
        });
        thread.push({
          role: "tool",
          tool_call_id: callId,
          name: toolName,
          content: summary,
        });
        continue;
      }

          // P0-2: identical (tool, args) calls make no progress. The second one
      // is refused instead of executed, which breaks "check status → check
      // options → check status" loops that used to burn the whole budget.
      const callKey = `${toolName}:${JSON.stringify(args ?? {})}`;
      const previousCall = callsSeen.get(callKey);
      if (previousCall) {
        callsSeen.set(callKey, previousCall + 1);
        const repeatSummary =
          `Duplicate call (${previousCall + 1}x) with identical arguments. ` +
          `It returned the same result and will not return anything new. ` +
          `Do not repeat it: change the arguments, use another tool, or finish ` +
          `this turn and report what you already know.`;
        input.emit({
          type: "tool_result",
          tool: toolName,
          id: callId,
          ok: false,
          summary: repeatSummary,
        });
        thread.push({
          role: "tool",
          tool_call_id: callId,
          name: toolName,
          content: repeatSummary,
        });
        continue;
      }
      callsSeen.set(callKey, 1);

  const denialSummary = await gateToolApproval({
        tool: toolName,
        args,
        canvasId: input.canvasId,
        ownerId: input.ownerId,
        sessionId: input.sessionId,
        signal: input.signal,
        emit: input.emit,
      });
      if (denialSummary) {
        thread.push({
          role: "tool",
          tool_call_id: callId,
          name: toolName,
          content: denialSummary,
        });
        input.emit({
          type: "tool_result",
          tool: toolName,
          id: callId,
          ok: false,
          summary: denialSummary,
        });
        continue;
      }

      try {
        const data = await executeCanvasTool({
          tool: toolName,
          args,
          actor: {
            kind: "user",
            userId: input.ownerId,
            canvasId: input.canvasId,
          },
        });
        const summary = summarizeToolResult(toolName, data);
        input.emit({
          type: "tool_result",
          tool: toolName,
          id: callId,
          ok: true,
          summary,
        });
        if (isGraphMutateTool(toolName)) {
          input.emit({ type: "graph_mutated", tool: toolName });
        }
        thread.push({
          role: "tool",
          tool_call_id: callId,
          name: toolName,
          content: summary,
        });
      } catch (error) {
        // Tool failure feeds the next step; it does not end the turn.
        const summary =
          error instanceof CanvasUpdateError || error instanceof Error
            ? error.message
            : "Tool failed";
        input.emit({
          type: "tool_result",
          tool: toolName,
          id: callId,
          ok: false,
          summary,
        });
        thread.push({
          role: "tool",
          tool_call_id: callId,
          name: toolName,
          content: summary,
        });
      }
    }
  }
  } finally {
    await endAgentTurn(turnKey);
  }

  if (input.signal?.aborted) {
    input.emit({ type: "done" });
    return;
  }

  // Soft wrap-up: summarize without tools, then pause for Continue.
  thread.push({
    role: "user",
    content:
      "Soft step budget for this turn is paused. Do not call any tools. Briefly summarize what you already completed and what remains. The user can Continue to keep working in the same session.",
  });
  try {
    await streamGenerateChat(
      connection.apiKey,
      {
        model,
        messages: thread,
      },
      {
        signal: input.signal,
        generation,
        onTextDelta: (delta) => {
          if (!delta || input.signal?.aborted) {
            return;
          }
          input.emit({ type: "text_delta", text: delta });
        },
      },
    );
  } catch {
    // Ignore wrap-up failures; step_budget still arms Continue.
  }
  if (!input.signal?.aborted) {
    input.emit({ type: "step_budget" });
  }
  input.emit({ type: "done" });
}
