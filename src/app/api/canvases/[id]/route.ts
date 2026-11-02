import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import {
  CanvasUpdateError,
  applyCanvasGraphUpdate,
  getOwnedActiveCanvas,
} from "@/lib/canvas/apply-canvas-graph-update";
import {
  collectGraphAssetIds,
  hydrateGraphNodeThumbnails,
  resolveCanvasCoverFields,
} from "@/lib/canvas/canvas-thumbnail";
import { isCanvasGraph, parseCanvasGraph } from "@/lib/canvas/graph";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updateCanvasSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  graph: z.unknown().optional(),
  version: z.number().int().positive(),
});

const thumbnailSelect = {
  id: true,
  url: true,
  thumbnailUrl: true,
  mediaType: true,
  status: true,
} as const;

async function getOwnedCanvas(canvasId: string, ownerId: string) {
  return prisma.canvas.findFirst({
    where: {
      id: canvasId,
      ownerId,
      status: "active",
    },
    include: {
      thumbnailAsset: { select: thumbnailSelect },
    },
  });
}

function serializeCanvasDetail(
  canvas: NonNullable<Awaited<ReturnType<typeof getOwnedCanvas>>>,
  graphOverride?: ReturnType<typeof parseCanvasGraph>,
) {
  const graph =
    graphOverride ??
    (isCanvasGraph(canvas.graph)
      ? parseCanvasGraph(canvas.graph)
      : canvas.graph);
  const cover = resolveCanvasCoverFields(
    canvas.thumbnailAssetId,
    canvas.thumbnailAsset,
    graph,
  );
  const nodeCount = isCanvasGraph(graph) ? graph.nodes.length : 0;
  return {
    id: canvas.id,
    title: canvas.title,
    version: canvas.version,
    status: canvas.status,
    graph,
    nodeCount,
    assets: [] as { assetId: string; nodeId: string }[],
    ...cover,
    createdAt: canvas.createdAt.toISOString(),
    updatedAt: canvas.updatedAt.toISOString(),
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const { id } = await context.params;
  const canvas = await getOwnedCanvas(id, user.id);
  if (!canvas) {
    return jsonError("Canvas not found", 404);
  }

  let graph = isCanvasGraph(canvas.graph)
    ? parseCanvasGraph(canvas.graph)
    : null;
  if (graph) {
    const assetIds = collectGraphAssetIds(graph);
    if (assetIds.length > 0) {
      const assets = await prisma.mediaAsset.findMany({
        where: {
          id: { in: assetIds },
          ownerId: user.id,
          status: "ready",
          thumbnailUrl: { not: null },
        },
        select: { id: true, thumbnailUrl: true },
      });
      graph = hydrateGraphNodeThumbnails(graph, assets);
    }
  }

  return jsonOk(
    serializeCanvasDetail(canvas, graph ?? undefined),
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = updateCanvasSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid request body", 400);
  }

  try {
    if (parsed.data.graph !== undefined) {
      if (!isCanvasGraph(parsed.data.graph)) {
        return jsonError("Invalid canvas graph", 400);
      }
      await applyCanvasGraphUpdate({
        canvasId: id,
        ownerId: user.id,
        expectedVersion: parsed.data.version,
        graph: parseCanvasGraph(parsed.data.graph),
        title: parsed.data.title,
      });
    } else {
      const canvas = await getOwnedActiveCanvas(id, user.id);
      if (!canvas) {
        return jsonError("Canvas not found", 404);
      }
      if (parsed.data.version !== canvas.version) {
        return jsonError("Version conflict", 409);
      }
      // Compare-and-swap so a concurrent writer cannot pass the same check.
      const result = await prisma.canvas.updateMany({
        where: { id: canvas.id, version: parsed.data.version },
        data: {
          ...(parsed.data.title ? { title: parsed.data.title } : {}),
          version: { increment: 1 },
        },
      });
      if (result.count === 0) {
        return jsonError("Version conflict", 409);
      }
    }
  } catch (error) {
    if (error instanceof CanvasUpdateError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }

  const updated = await getOwnedCanvas(id, user.id);
  if (!updated) {
    return jsonError("Canvas not found", 404);
  }
  return jsonOk(serializeCanvasDetail(updated));
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const { id } = await context.params;
  const canvas = await getOwnedCanvas(id, user.id);
  if (!canvas) {
    return jsonError("Canvas not found", 404);
  }

  await prisma.canvas.update({
    where: { id: canvas.id },
    data: { status: "archived" },
  });

  return jsonOk({ ok: true as const });
}
