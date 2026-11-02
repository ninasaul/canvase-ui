import { z } from "zod";

import {
  runCanvasAgentChat,
  type CanvasAgentChatMessage,
  type CanvasAgentChatSseEvent,
} from "@/lib/agent/canvas-agent-chat";
import {
  appendChatMessageSafe,
  getLatestChatSessionId,
} from "@/lib/agent/canvas-agent-chat-store";
import { jsonError } from "@/lib/api";
import { getOwnedActiveCanvas } from "@/lib/canvas/apply-canvas-graph-update";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 300;

const mediaAttachmentSchema = z.object({
  url: z.string().trim().min(1).max(16_000),
  kind: z.enum(["image", "video", "audio"]).optional(),
});

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "tool", "system"]),
  content: z.preprocess(
    (value) => (typeof value === "string" ? value : value == null ? "" : String(value)),
    z.string(),
  ),
  attachments: z.array(mediaAttachmentSchema).max(4).optional(),
  /** @deprecated Prefer attachments. */
  images: z.array(mediaAttachmentSchema).max(4).optional(),
  toolCallId: z.string().optional(),
  name: z.string().optional(),
});

const bodySchema = z.object({
  canvasId: z.string().trim().min(1),
  /** Client id of the user turn; dedupes retries when persisting history. */
  messageId: z.string().trim().max(80).optional(),
  /** Conversation boundary; omit to continue the latest session. */
  sessionId: z.string().trim().max(80).optional(),
  messages: z.array(messageSchema).min(1).max(120),
  model: z.string().trim().min(1).max(200),
  vendor: z.preprocess(
    (value) =>
      value === "" || value === null || value === undefined
        ? undefined
        : value,
    z.string().trim().max(120).optional(),
  ),
});

function encodeSse(event: CanvasAgentChatSseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues[0];
    const path = detail?.path?.length ? detail.path.join(".") : "body";
    const reason = detail?.message?.trim() || "validation failed";
    return jsonError(`Invalid request body (${path}: ${reason})`, 400);
  }

  const canvas = await getOwnedActiveCanvas(parsed.data.canvasId, user.id);
  if (!canvas) {
    return jsonError("Canvas not found", 404);
  }

  const messages = parsed.data.messages as CanvasAgentChatMessage[];

  // Persist the user turn before streaming so history survives even when the
  // upstream fails. `messageId` keeps retries idempotent.
  const lastUser = [...messages].reverse().find((item) => item.role === "user");
  const sessionId =
    parsed.data.sessionId?.trim() ||
    (await getLatestChatSessionId({
      canvasId: parsed.data.canvasId,
      ownerId: user.id,
    })) ||
    `session-${crypto.randomUUID()}`;
  if (lastUser) {
    appendChatMessageSafe({
      canvasId: parsed.data.canvasId,
      ownerId: user.id,
      role: "user",
      content: lastUser.content ?? "",
      sessionId,
      attachments: lastUser.attachments ?? lastUser.images,
      clientId: parsed.data.messageId ?? null,
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let assistantText = "";
      const emit = (event: CanvasAgentChatSseEvent) => {
        if (event.type === "text_delta") {
          assistantText += event.text;
        }
        if (closed || request.signal.aborted) {
          return;
        }
        try {
          controller.enqueue(encoder.encode(encodeSse(event)));
        } catch {
          closed = true;
        }
      };
      try {
        await runCanvasAgentChat({
          canvasId: parsed.data.canvasId,
          ownerId: user.id,
          messages,
          model: parsed.data.model,
          vendor: parsed.data.vendor,
          signal: request.signal,
          emit,
        });
      } catch (error) {
        if (!request.signal.aborted) {
          emit({
            type: "error",
            message:
              error instanceof Error ? error.message : "Agent chat failed",
          });
          emit({ type: "done" });
        }
      } finally {
        if (assistantText.trim()) {
          appendChatMessageSafe({
            canvasId: parsed.data.canvasId,
            ownerId: user.id,
            role: "assistant",
            content: assistantText,
            sessionId,
          });
        }
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed by client abort.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
