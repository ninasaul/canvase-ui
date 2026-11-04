import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CanvasChatRole = "user" | "assistant";

export type CanvasChatAttachment = {
  url: string;
  kind?: string;
  name?: string;
};

export type CanvasChatStoredMessage = {
  id: string;
  role: CanvasChatRole;
  content: string;
  sessionId: string;
  attachments: CanvasChatAttachment[] | null;
  createdAt: string;
};

/** Keep the transcript bounded; oldest rows are pruned on write. */
const MAX_MESSAGES_PER_CANVAS = 400;
const MAX_CONTENT_CHARS = 20_000;

function normalizeAttachments(value: unknown): CanvasChatAttachment[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items: CanvasChatAttachment[] = [];
  for (const entry of value.slice(0, 8)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const url = typeof record.url === "string" ? record.url.trim() : "";
    if (!url || url.length > 16_000) {
      continue;
    }
    items.push({
      url,
      ...(typeof record.kind === "string" ? { kind: record.kind } : {}),
      ...(typeof record.name === "string" ? { name: record.name.slice(0, 200) } : {}),
    });
  }
  return items.length > 0 ? items : null;
}

async function prune(canvasId: string): Promise<void> {
  const stale = await prisma.canvasChatMessage.findMany({
    where: { canvasId },
    orderBy: { createdAt: "desc" },
    skip: MAX_MESSAGES_PER_CANVAS,
    select: { id: true },
  });
  if (stale.length === 0) {
    return;
  }
  await prisma.canvasChatMessage.deleteMany({
    where: { id: { in: stale.map((row) => row.id) } },
  });
}

/**
 * Append one transcript row. Idempotent for user turns via `clientId`,
 * so a retried request never duplicates the message.
 */
export async function appendChatMessage(input: {
  canvasId: string;
  ownerId: string;
  role: CanvasChatRole;
  content: string;
  sessionId: string;
  attachments?: unknown;
  clientId?: string | null;
}): Promise<void> {
  const content = input.content.trim().slice(0, MAX_CONTENT_CHARS);
  const attachments = normalizeAttachments(input.attachments);
  if (!content && !attachments) {
    return;
  }
  try {
    await prisma.canvasChatMessage.create({
      data: {
        canvasId: input.canvasId,
        ownerId: input.ownerId,
        role: input.role,
        sessionId: input.sessionId,
        content,
        ...(attachments
          ? { attachments: attachments as unknown as Prisma.InputJsonValue }
          : {}),
        ...(input.role === "user" && input.clientId
          ? { clientId: input.clientId.slice(0, 80) }
          : {}),
      },
    });
  } catch (error) {
    // Duplicate clientId (retry) — the message is already stored.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }
    throw error;
  }
  void prune(input.canvasId).catch(() => undefined);
}

/** Chat persistence must never break streaming. */
export function appendChatMessageSafe(
  input: Parameters<typeof appendChatMessage>[0],
): void {
  void appendChatMessage(input).catch(() => undefined);
}

export async function listChatMessages(input: {
  canvasId: string;
  ownerId: string;
  limit?: number;
}): Promise<CanvasChatStoredMessage[]> {
  const limit = Math.min(Math.max(input.limit ?? 200, 1), MAX_MESSAGES_PER_CANVAS);
  const rows = await prisma.canvasChatMessage.findMany({
    where: { canvasId: input.canvasId, ownerId: input.ownerId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.reverse().map((row) => ({
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content,
    sessionId: row.sessionId,
    attachments: normalizeAttachments(row.attachments),
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function clearChatMessages(input: {
  canvasId: string;
  ownerId: string;
}): Promise<number> {
  const result = await prisma.canvasChatMessage.deleteMany({
    where: { canvasId: input.canvasId, ownerId: input.ownerId },
  });
  // Summaries are positional ("the first N turns are folded into this text").
  // Keeping them after the transcript is gone made the next turn fold a
  // transcript that no longer existed and drop the live conversation.
  await prisma.canvasChatSummary
    .deleteMany({ where: { canvasId: input.canvasId } })
    .catch(() => undefined);
  return result.count;
}

/** Most recent session id, used when the client does not supply one. */
export async function getLatestChatSessionId(input: {
  canvasId: string;
  ownerId: string;
}): Promise<string | null> {
  const row = await prisma.canvasChatMessage.findFirst({
    where: { canvasId: input.canvasId, ownerId: input.ownerId },
    orderBy: { createdAt: "desc" },
    select: { sessionId: true },
  });
  return row?.sessionId ?? null;
}
