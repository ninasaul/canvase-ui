import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { AGENT_SCOPES } from "@/lib/agent/agent-scopes";
import {
  buildMcpConfigSnippet,
  createAgentToken,
  listAgentTokens,
} from "@/lib/agent/agent-token";
import { getOwnedActiveCanvas } from "@/lib/canvas/apply-canvas-graph-update";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

const createSchema = z.object({
  canvasId: z.string().trim().min(1),
  scopes: z.array(z.enum(AGENT_SCOPES)).optional(),
  label: z.string().trim().max(120).optional(),
  ttlHours: z.number().int().min(1).max(24 * 30).optional(),
});

function resolvePublicBaseUrl(request: Request): string {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "";
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }
  return new URL(request.url).origin;
}

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
  const tokens = await listAgentTokens({
    ownerId: user.id,
    canvasId,
  });
  return jsonOk({ items: tokens });
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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid request body", 400);
  }

  const canvas = await getOwnedActiveCanvas(parsed.data.canvasId, user.id);
  if (!canvas) {
    return jsonError("Canvas not found", 404);
  }

  const created = await createAgentToken({
    ownerId: user.id,
    canvasId: parsed.data.canvasId,
    scopes: parsed.data.scopes,
    label: parsed.data.label,
    ttlHours: parsed.data.ttlHours,
  });
  const baseUrl = resolvePublicBaseUrl(request);
  const mcpConfig = buildMcpConfigSnippet({
    baseUrl,
    token: created.token.plaintext,
    canvasId: created.token.canvasId,
  });

  return jsonOk({
    id: created.token.id,
    token: created.token.plaintext,
    canvasId: created.token.canvasId,
    scopes: created.token.scopes,
    label: created.token.label,
    expiresAt: created.token.expiresAt.toISOString(),
    mcpConfig,
    env: {
      CANVASE_BASE_URL: baseUrl,
      CANVASE_TOKEN: created.token.plaintext,
      CANVASE_CANVAS_ID: created.token.canvasId,
    },
  });
}
