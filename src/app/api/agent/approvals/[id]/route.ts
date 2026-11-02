import { z } from "zod";

import { resolveApproval, type ApprovalDecision } from "@/lib/agent/canvas-approvals";
import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

const bodySchema = z.object({
  decision: z.enum(["allow_once", "allow_session", "deny"]),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Answers a pending approval raised while an agent turn is streaming.
 * The turn is blocked server-side until this lands (or it times out).
 */
export async function POST(request: Request, context: RouteContext) {
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
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid decision", 400);
  }
  const decision: ApprovalDecision = parsed.data.decision;
  const resolved = resolveApproval(id, decision, user.id);
  if (!resolved) {
    return jsonError("Approval request not found or already answered", 404);
  }
  return jsonOk({ id, decision });
}
