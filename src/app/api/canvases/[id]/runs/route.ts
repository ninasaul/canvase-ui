import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { getOwnedActiveCanvas } from "@/lib/canvas/apply-canvas-graph-update";
import type { Prisma } from "@prisma/client";
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

const recordSchema = z.object({
  mode: z.enum(["all", "selected", "node", "from", "retry-failed"]),
  status: z.enum(["succeeded", "partial", "failed", "cancelled"]),
  nodeIds: z.array(z.string().trim().min(1)).min(1).max(500),
  nodeStates: z.record(
    z.string(),
    z.object({
      status: z.enum([
        "pending",
        "queued",
        "running",
        "succeeded",
        "failed",
        "skipped",
        "cancelled",
        "interrupted",
      ]),
      error: z.string().max(2_000).optional().nullable(),
    }),
  ),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
});

/**
 * Records an editor-initiated run. Editor runs execute in the browser, so the
 * server only learns about them here — without this they never appeared in the
 * run history.
 */
export async function POST(request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }
  const { id } = await context.params;
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
  const parsed = recordSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid request body", 400);
  }
  const row = await prisma.canvasAgentRun.create({
    data: {
      canvasId: id,
      ownerId: user.id,
      mode: parsed.data.mode,
      status: parsed.data.status,
      nodeIds: parsed.data.nodeIds,
      nodeStates: parsed.data.nodeStates as Prisma.InputJsonValue,
      ...(parsed.data.startedAt ? { startedAt: new Date(parsed.data.startedAt) } : {}),
      ...(parsed.data.finishedAt ? { finishedAt: new Date(parsed.data.finishedAt) } : {}),
    },
    select: { id: true },
  });
  return jsonOk({ id: row.id });
}
