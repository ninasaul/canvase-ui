import { jsonOk } from "@/lib/api";
import {
  CANVAS_TOOL_NAMES,
  canvasToolSchemas,
} from "@/lib/agent/canvas-tools";

export const runtime = "nodejs";

export async function GET() {
  return jsonOk({
    tools: CANVAS_TOOL_NAMES.map((name) => ({
      name,
      ...canvasToolSchemas[name],
    })),
  });
}
