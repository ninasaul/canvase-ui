import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CanvasCommandLogInput = {
  canvasId: string;
  actorType: "user" | "agent";
  actorId: string;
  tool: string;
  args: unknown;
  result: unknown;
  versionBefore: number;
  versionAfter: number;
};

/**
 * Audit row for anything that moves `canvas.version`.
 * Every write path must log here, including agent runs that snapshot the graph
 * outside of a tool call — otherwise version bumps become untraceable.
 */
export async function writeCommandLog(
  input: CanvasCommandLogInput,
): Promise<void> {
  await prisma.canvasCommandLog.create({
    data: {
      canvasId: input.canvasId,
      actorType: input.actorType,
      actorId: input.actorId,
      tool: input.tool,
      input: input.args as Prisma.InputJsonValue,
      result: input.result as Prisma.InputJsonValue,
      versionBefore: input.versionBefore,
      versionAfter: input.versionAfter,
    },
  });
}

/** Same as {@link writeCommandLog} but never throws into the write path. */
export function writeCommandLogSafe(input: CanvasCommandLogInput): void {
  void writeCommandLog(input).catch(() => undefined);
}
