import { jsonOk } from "@/lib/api";
import {
  AGENT_TOOL_NAMES,
  canvasToolSchemas,
} from "@/lib/agent/canvas-tools";

export const runtime = "nodejs";

export async function GET() {
  return jsonOk({
    tools: AGENT_TOOL_NAMES.map((name) => ({
      name,
      ...canvasToolSchemas[name],
    })),
  });
}
