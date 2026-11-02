import { z } from "zod";

import {
  appendChatMessageSafe,
  getLatestChatSessionId,
} from "@/lib/agent/canvas-agent-chat-store";
import { queueSteer } from "@/lib/agent/canvas-steering";
import { jsonError, jsonOk } from "@/lib/api";
import { getOwnedActiveCanvas } from "@/lib/canvas/apply-canvas-graph-update";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

const bodySchema = z.object({
  canvasId: z.string().trim().min(1),
  sessionId: z.string().trim().max(80).optional(),
  messageId: z.string().trim().max(80).optional(),
  content: z.string().trim().min(1).max(4_000),
});

/**
 * Mid-turn instruction: queued and folded into the conversation at the agent's
 * next step, instead of aborting the turn. Falls back to 409 when nothing is
 * streaming so the client can send a normal message instead.
 */
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
    return jsonError("Invalid request body", 400);
  }
  const canvas = await getOwnedActiveCanvas(parsed.data.canvasId, user.id);
  if (!canvas) {
    return jsonError("Canvas not found", 404);
  }

  const sessionId =
    parsed.data.sessionId?.trim() ||
    (await getLatestChatSessionId({
      canvasId: parsed.data.canvasId,
      ownerId: user.id,
    })) ||
    `session-${crypto.randomUUID()}`;
  const id = parsed.data.messageId?.trim() || `steer_${crypto.randomUUID()}`;
  const queued = queueSteer(
    { canvasId: parsed.data.canvasId, sessionId },
    { id, content: parsed.data.content, createdAt: Date.now() },
  );
  if (!queued) {
    return jsonError("No active turn to steer", 409);
  }

  // Keep the transcript honest: the user did say this, mid-turn.
  appendChatMessageSafe({
    canvasId: parsed.data.canvasId,
    ownerId: user.id,
    role: "user",
    content: parsed.data.content,
    sessionId,
    clientId: id,
  });

  return jsonOk({ id, queued: true });
}
