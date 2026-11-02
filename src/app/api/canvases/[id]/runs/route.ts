import { jsonError, jsonOk } from "@/lib/api";
import { getOwnedActiveCanvas } from "@/lib/canvas/apply-canvas-graph-update";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Run history for the canvas dialog. Runs are agent-initiated today
 * (`canvas_run`); editor-local runs never reach the server.
 */
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

  const limitParam = Number(
    new URL(request.url).searchParams.get("limit") ?? "20",
  );
  const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 20, 1), 100);

  const rows = await prisma.canvasAgentRun.findMany({
    where: { canvasId: id, ownerId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return jsonOk(
    rows.map((row) => ({
      id: row.id,
      canvasId: row.canvasId,
      mode: row.mode,
      status: row.status,
      error: row.error,
      createdAt: row.createdAt.toISOString(),
      startedAt: row.startedAt?.toISOString() ?? null,
      finishedAt: row.finishedAt?.toISOString() ?? null,
      nodeCount: row.nodeIds.length,
    })),
  );
}
