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
import { loadSkillCatalog, type CanvasSkill } from "@/lib/agent/skills";
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
): string {
  return [
    "You are the Canvase canvas agent. You help the user inspect and edit one canvas graph, and can start generation runs.",
    `Target canvas id: ${canvasId}.`,
    "Always call canvas_get first in a session (or after edits) to learn the current version and node ids.",
    "Every edit tool requires expectedVersion from the latest canvas_get / edit response. On version conflict, canvas_get again and retry.",
    "Prefer small, reversible edits. Confirm destructive deletes briefly in text when unsure.",
    "Use canvas_run to generate (modes: all | selected | node | from | retry-failed; `node` runs only the selected nodes, skipping upstream; selecting a group node expands to its children). Poll canvas_run_status when the user asks about progress.",
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
    catalogLines.push(`- ${kind}: ${publicUrl}`);
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

function summarizeToolResult(result: unknown): string {
  try {
    const text = JSON.stringify(result);
    if (text.length <= 400) {
      return text;
    }
    return `${text.slice(0, 400)}…`;
  } catch {
    return String(result);
  }
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

export async function runCanvasAgentChat(input: {
  canvasId: string;
  ownerId: string;
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
  const thread: Array<Record<string, unknown>> = [
    {
      role: "system",
      content: buildCanvasAgentSystemPrompt(input.canvasId, skills),
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

  // Primary exits (harness-like): model stops tools, or caller aborts.
  // Soft step budget only pauses the turn for Continue — never errors the session.
  for (
    let step = 0;
    step < CANVAS_AGENT_CHAT_SOFT_STEP_BUDGET;
    step += 1
  ) {
    if (input.signal?.aborted) {
      input.emit({ type: "done" });
      return;
    }

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
      input.emit({
        type: "error",
        message:
          error instanceof Error ? error.message : "Chat completion failed",
      });
      input.emit({ type: "done" });
      return;
    }

    if (toolCalls.length === 0) {
      if (text) {
        thread.push({ role: "assistant", content: text });
      } else if (step === 0) {
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
        const summary = summarizeToolResult(data);
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
