import { jsonError, jsonOk } from "@/lib/api";
import { resolveAgentTokenFromBearer } from "@/lib/agent/agent-token";
import {
  executeCanvasTool,
  isAgentToolName,
} from "@/lib/agent/canvas-tools";
import { CanvasUpdateError } from "@/lib/canvas/apply-canvas-graph-update";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ toolName: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { toolName } = await context.params;
  if (!isAgentToolName(toolName)) {
    return jsonError("Unknown tool", 404);
  }

  const token = await resolveAgentTokenFromBearer(
    request.headers.get("authorization"),
  );
  if (!token) {
    return jsonError("Unauthorized", 401);
  }

  let body: unknown = {};
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }
  }

  try {
    const data = await executeCanvasTool({
      tool: toolName,
      args: body,
      actor: { kind: "agent", token },
    });
    return jsonOk({ ok: true as const, data });
  } catch (error) {
    if (error instanceof CanvasUpdateError) {
      return jsonError(error.message, error.status);
    }
    return jsonError(
      error instanceof Error ? error.message : "Tool execution failed",
      500,
    );
  }
}
