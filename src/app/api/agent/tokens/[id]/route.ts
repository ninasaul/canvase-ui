import { jsonError, jsonOk } from "@/lib/api";
import { revokeAgentToken } from "@/lib/agent/agent-token";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }
  const { id } = await context.params;
  const revoked = await revokeAgentToken({
    ownerId: user.id,
    tokenId: id,
  });
  if (!revoked) {
    return jsonError("Token not found", 404);
  }
  return jsonOk({ ok: true as const });
}
