import { Prisma } from "@prisma/client";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { getOwnedActiveCanvas } from "@/lib/canvas/apply-canvas-graph-update";
import { isCanvasGraph, parseCanvasGraph } from "@/lib/canvas/graph";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const duplicateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

function copyTitle(title: string): string {
  const base = title.trim() || "Untitled Canvas";
  const next = `${base} copy`;
  return next.length > 120 ? next.slice(0, 120) : next;
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const { id } = await context.params;
  const source = await getOwnedActiveCanvas(id, user.id);
  if (!source) {
    return jsonError("Canvas not found", 404);
  }

  let body: unknown = {};
  if ((request.headers.get("content-type") ?? "").includes("application/json")) {
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }
  }
  const parsed = duplicateSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return jsonError("Invalid request body", 400);
  }

  const graph = isCanvasGraph(source.graph)
    ? parseCanvasGraph(source.graph)
    : source.graph;

  const created = await prisma.canvas.create({
    data: {
      ownerId: user.id,
      title: parsed.data.title?.trim() || copyTitle(source.title),
      graph: graph as Prisma.InputJsonValue,
      thumbnailAssetId: source.thumbnailAssetId,
    },
  });

  return jsonOk(
    {
      id: created.id,
      title: created.title,
      version: created.version,
      status: created.status,
      graph: created.graph,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
    { status: 201 },
  );
}
