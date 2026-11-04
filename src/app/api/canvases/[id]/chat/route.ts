import { jsonError, jsonOk } from "@/lib/api";
import {
  clearChatMessages,
  listChatMessages,
} from "@/lib/agent/canvas-agent-chat-store";
import { prisma } from "@/lib/prisma";
import { getOwnedActiveCanvas } from "@/lib/canvas/apply-canvas-graph-update";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const { id } = await context.params;
  const canvas = await getOwnedActiveCanvas(id, user.id);
  if (!canvas) {
    return jsonError("Canvas not found", 404);
  }

  const limitParam = Number(new URL(request.url).searchParams.get("limit") ?? "200");
  const messages = await listChatMessages({
    canvasId: id,
    ownerId: user.id,
    limit: Number.isFinite(limitParam) ? limitParam : 200,
  });

  const summaries = await prisma.canvasChatSummary.findMany({
    where: { canvasId: id },
    select: {
      sessionId: true,
      summary: true,
      coveredCount: true,
      coveredThrough: true,
    },
  });

  return jsonOk({ messages, summaries });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const { id } = await context.params;
  const canvas = await getOwnedActiveCanvas(id, user.id);
  if (!canvas) {
    return jsonError("Canvas not found", 404);
  }

  const deleted = await clearChatMessages({ canvasId: id, ownerId: user.id });
  return jsonOk({ deleted });
}
