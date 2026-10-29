import { jsonError, jsonOk } from "@/lib/api";
import { getActiveCanvasAgentRun } from "@/lib/agent/canvas-agent-run-service";
import { getOwnedActiveCanvas } from "@/lib/canvas/apply-canvas-graph-update";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }
  const canvasId = new URL(request.url).searchParams.get("canvasId")?.trim();
  if (!canvasId) {
    return jsonError("canvasId is required", 400);
  }
  const canvas = await getOwnedActiveCanvas(canvasId, user.id);
  if (!canvas) {
    return jsonError("Canvas not found", 404);
  }
  const run = await getActiveCanvasAgentRun({
    canvasId,
    ownerId: user.id,
  });
  return jsonOk({ run });
}
