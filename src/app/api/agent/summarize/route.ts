import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { getOwnedActiveCanvas } from "@/lib/canvas/apply-canvas-graph-update";
import { requireUser } from "@/lib/session";
import { resolveUserGenerationConnection } from "@/lib/generation/generation-config-server";
import { streamGenerateChat } from "@/lib/v1-chat-stream";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  canvasId: z.string().trim().min(1),
  sessionId: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(200),
  vendor: z.string().trim().max(120).optional(),
  /** Oldest slice of the conversation, already trimmed by the client. */
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(20_000),
      }),
    )
    .min(1)
    .max(60),
});

const SUMMARY_PROMPT = [
  "You compress a conversation between a user and a canvas-editing agent.",
  "Write a dense briefing that lets the agent continue seamlessly:",
  "- what the user wants (goal, constraints, taste)",
  "- what was done (nodes added/changed, runs started, decisions)",
  "- what is still open or was rejected",
  "Keep node ids, model names and numbers. No pleasantries, no markdown headings,",
  "at most 160 words. Write in the language the user used.",
].join("\n");

/**
 * Folds the oldest part of a conversation into a rolling summary. The client
 * sends only the slice it is about to drop; the stored `coveredCount` tells
 * later requests how much of the transcript the summary already stands for.
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

  const connection = await resolveUserGenerationConnection(user.id, {
    vendorId: parsed.data.vendor,
    modelId: parsed.data.model,
  }).catch(() => null);
  if (!connection || (!connection.baseUrl && !connection.apiKey)) {
    return jsonError("Chat generation is not configured", 400);
  }

  const transcript = parsed.data.messages
    .map((message) =>
      `${message.role === "user" ? "User" : "Agent"}: ${message.content}`,
    )
    .join("\n\n");

  let summary = "";
  try {
    const result = await streamGenerateChat(
      connection.apiKey,
      {
        model: parsed.data.model,
        messages: [
          { role: "system", content: SUMMARY_PROMPT },
          { role: "user", content: transcript },
        ],
      },
      {
        generation: {
          baseUrl: connection.baseUrl || undefined,
          apiKey: connection.apiKey || undefined,
          vendorId: connection.vendorId || undefined,
        },
      },
    );
    summary = result.content.trim();
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Summarization failed",
      502,
    );
  }
  if (!summary) {
    return jsonError("Summarization returned nothing", 502);
  }

  const covered = parsed.data.messages.filter(
    (message) => message.role === "user" || message.role === "assistant",
  ).length;

  const existing = await prisma.canvasChatSummary.findUnique({
    where: {
      canvasId_sessionId: {
        canvasId: parsed.data.canvasId,
        sessionId: parsed.data.sessionId,
      },
    },
    select: { summary: true, coveredCount: true },
  });

  // Compaction can run repeatedly: fold the previous summary into the new one
  // so nothing is lost between slices.
  if (existing?.summary) {
    summary = `${existing.summary}\n\n[more recent]\n${summary}`.slice(-4_000);
  }
  const coveredCount = (existing?.coveredCount ?? 0) + covered;

  await prisma.canvasChatSummary.upsert({
    where: {
      canvasId_sessionId: {
        canvasId: parsed.data.canvasId,
        sessionId: parsed.data.sessionId,
      },
    },
    create: {
      canvasId: parsed.data.canvasId,
      sessionId: parsed.data.sessionId,
      summary,
      coveredCount,
    },
    update: { summary, coveredCount },
  });

  return jsonOk({ summary, coveredCount });
}
