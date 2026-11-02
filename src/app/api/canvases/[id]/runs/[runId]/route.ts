import { jsonError, jsonOk } from "@/lib/api";
import { getOwnedActiveCanvas } from "@/lib/canvas/apply-canvas-graph-update";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; runId: string }>;
};

type NodeState = {
  status?: string;
  error?: string;
  requestId?: string;
  outputUrl?: string;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const { id, runId } = await context.params;
  const canvas = await getOwnedActiveCanvas(id, user.id);
  if (!canvas) {
    return jsonError("Canvas not found", 404);
  }

  const row = await prisma.canvasAgentRun.findFirst({
    where: { id: runId, canvasId: id, ownerId: user.id },
  });
  if (!row) {
    return jsonError("Run not found", 404);
  }

  const states =
    row.nodeStates && typeof row.nodeStates === "object"
      ? (row.nodeStates as Record<string, NodeState>)
      : {};

  return jsonOk({
    id: row.id,
    canvasId: row.canvasId,
    mode: row.mode,
    status: row.status,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    nodes: row.nodeIds.map((nodeId) => {
      const state = states[nodeId] ?? {};
      return {
        nodeId,
        status: state.status ?? "pending",
        error: state.error ?? null,
        outputUrl: state.outputUrl ?? null,
        assetId: null,
        startedAt: null,
        finishedAt: null,
        requestId: state.requestId ?? null,
        taskId: null,
        data: null,
      };
    }),
  });
}
