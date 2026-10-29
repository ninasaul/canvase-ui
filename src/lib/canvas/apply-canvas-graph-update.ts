import { Prisma } from "@prisma/client";
import {
  isCanvasGraph,
  parseCanvasGraph,
  type CanvasGraph,
} from "@/lib/canvas/graph";
import { prisma } from "@/lib/prisma";

export class CanvasUpdateError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CanvasUpdateError";
  }
}

export type OwnedCanvasRow = {
  id: string;
  ownerId: string;
  title: string;
  version: number;
  status: string;
  graph: unknown;
  thumbnailAssetId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function getOwnedActiveCanvas(
  canvasId: string,
  ownerId: string,
): Promise<OwnedCanvasRow | null> {
  return prisma.canvas.findFirst({
    where: {
      id: canvasId,
      ownerId,
      status: "active",
    },
  });
}

export async function applyCanvasGraphUpdate(input: {
  canvasId: string;
  ownerId: string;
  expectedVersion: number;
  graph: CanvasGraph;
  title?: string;
}): Promise<{
  canvas: OwnedCanvasRow;
  versionBefore: number;
  versionAfter: number;
}> {
  const canvas = await getOwnedActiveCanvas(input.canvasId, input.ownerId);
  if (!canvas) {
    throw new CanvasUpdateError("Canvas not found", 404);
  }
  if (input.expectedVersion !== canvas.version) {
    throw new CanvasUpdateError("Version conflict", 409);
  }
  if (!isCanvasGraph(input.graph)) {
    throw new CanvasUpdateError("Invalid canvas graph", 400);
  }
  // Re-parse to normalize / strip invalid optional fields.
  const graph = parseCanvasGraph(input.graph);
  const updated = await prisma.canvas.update({
    where: { id: canvas.id },
    data: {
      ...(input.title ? { title: input.title } : {}),
      graph: graph as unknown as Prisma.InputJsonValue,
      version: { increment: 1 },
    },
  });
  return {
    canvas: updated,
    versionBefore: canvas.version,
    versionAfter: updated.version,
  };
}

export function readCanvasGraph(canvas: OwnedCanvasRow): CanvasGraph {
  if (!isCanvasGraph(canvas.graph)) {
    throw new CanvasUpdateError("Invalid canvas graph", 500);
  }
  return parseCanvasGraph(canvas.graph);
}
