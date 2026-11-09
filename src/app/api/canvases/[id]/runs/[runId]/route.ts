import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { getOwnedActiveCanvas } from "@/lib/canvas/apply-canvas-graph-update";
import type { Prisma } from "@prisma/client";
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
    updatedAt: row.updatedAt.toISOString(),
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

const patchSchema = z.object({
  status: z.enum([
    "queued",
    "running",
    "succeeded",
    "partial",
    "failed",
    "cancelled",
  ]),
  nodeStates: z
    .record(
      z.string(),
      z.object({
        status: z.string().max(40),
        error: z.string().max(2_000).optional().nullable(),
      }),
    )
    .optional(),
  error: z.string().max(2_000).optional().nullable(),
  finishedAt: z.string().datetime().optional(),
});

/** Finalises an editor-run record that was created when the run started. */
export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }
  const { id, runId } = await context.params;
  const canvas = await getOwnedActiveCanvas(id, user.id);
  if (!canvas) {
    return jsonError("Canvas not found", 404);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid request body", 400);
  }
  const result = await prisma.canvasAgentRun.updateMany({
    where: { id: runId, canvasId: id, ownerId: user.id },
    data: {
      status: parsed.data.status,
      ...(parsed.data.nodeStates
        ? { nodeStates: parsed.data.nodeStates as Prisma.InputJsonValue }
        : {}),
      ...(parsed.data.error !== undefined ? { error: parsed.data.error } : {}),
      ...(parsed.data.finishedAt
        ? { finishedAt: new Date(parsed.data.finishedAt) }
        : {}),
    },
  });
  if (result.count === 0) {
    return jsonError("Run not found", 404);
  }
  return jsonOk({ id: runId });
}
