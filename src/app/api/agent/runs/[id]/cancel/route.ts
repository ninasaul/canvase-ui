import { jsonError, jsonOk } from "@/lib/api";
import { cancelCanvasAgentRun } from "@/lib/agent/canvas-agent-run-service";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }
  const { id } = await context.params;
  const canvasId = new URL(_request.url).searchParams.get("canvasId")?.trim();
  if (!canvasId) {
    return jsonError("canvasId is required", 400);
  }
  try {
    const run = await cancelCanvasAgentRun({
      runId: id,
      canvasId,
      ownerId: user.id,
    });
    return jsonOk({ run });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Cancel failed",
      404,
    );
  }
}