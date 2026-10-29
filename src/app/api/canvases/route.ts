import { Prisma } from "@prisma/client";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { resolveCanvasCoverFields } from "@/lib/canvas/canvas-thumbnail";
import { createEmptyCanvasGraph, isCanvasGraph } from "@/lib/canvas/graph";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const createCanvasSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  graph: z.unknown().optional(),
});

const thumbnailSelect = {
  id: true,
  url: true,
  thumbnailUrl: true,
  mediaType: true,
  status: true,
} as const;

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(searchParams.get("limit") ?? "20") || 20),
  );
  const search = searchParams.get("search")?.trim() ?? "";

  const where = {
    ownerId: user.id,
    status: "active" as const,
    ...(search
      ? {
          title: {
            contains: search,
            mode: "insensitive" as const,
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.canvas.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        version: true,
        status: true,
        thumbnailAssetId: true,
        createdAt: true,
        updatedAt: true,
        graph: true,
        thumbnailAsset: { select: thumbnailSelect },
      },
    }),
    prisma.canvas.count({ where }),
  ]);

  return jsonOk({
    items: items.map((item) => {
      const graph = isCanvasGraph(item.graph) ? item.graph : null;
      const cover = resolveCanvasCoverFields(
        item.thumbnailAssetId,
        item.thumbnailAsset,
        item.graph,
      );
      return {
        id: item.id,
        title: item.title,
        version: item.version,
        status: item.status,
        nodeCount: graph?.nodes.length ?? 0,
        ...cover,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      };
    }),
    total,
    page,
    limit,
  });
}

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

  const parsed = createCanvasSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid request body", 400);
  }

  const graph =
    parsed.data.graph !== undefined
      ? isCanvasGraph(parsed.data.graph)
        ? parsed.data.graph
        : null
      : createEmptyCanvasGraph();

  if (!graph) {
    return jsonError("Invalid canvas graph", 400);
  }

  const canvas = await prisma.canvas.create({
    data: {
      ownerId: user.id,
      title: parsed.data.title?.trim() || "Untitled Canvas",
      graph: graph as Prisma.InputJsonValue,
    },
  });

  return jsonOk(
    {
      id: canvas.id,
      title: canvas.title,
      version: canvas.version,
      status: canvas.status,
      graph: canvas.graph,
      nodeCount: graph.nodes.length,
      assets: [],
      thumbnailAssetId: null,
      thumbnailUrl: null,
      previewUrl: null,
      previewType: null,
      createdAt: canvas.createdAt.toISOString(),
      updatedAt: canvas.updatedAt.toISOString(),
    },
    { status: 201 },
  );
}
