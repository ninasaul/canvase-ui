import { prisma } from "@/lib/prisma";
import { readCanvasGraph } from "@/lib/canvas/apply-canvas-graph-update";
import { buildCanvasRunPlan, type CanvasRunMode } from "@/lib/canvas/canvas-run-plan";

export type ApprovalDecision = "allow_once" | "allow_session" | "deny";

export type ApprovalDetails = {
  nodes?: number;
  overwrite?: number;
  mode?: string;
};

export type ApprovalCheck =
  | { required: false }
  | { required: true; summary: string; details: ApprovalDetails };

export type PendingApproval = {
  id: string;
  ownerId: string;
  canvasId: string;
  sessionId?: string;
  tool: string;
  createdAt: number;
  resolve: (decision: ApprovalDecision) => void;
};

/** Longest a turn will block waiting for a human decision. */
const APPROVAL_TIMEOUT_MS = 120_000;
/** Session-wide grants expire so a stale consent cannot be reused next week. */
const SESSION_GRANT_TTL_MS = 30 * 60_000;
/** Bulk deletions below this size go through without asking. */
const DELETE_APPROVAL_THRESHOLD = 5;

const pending = new Map<string, PendingApproval>();
const sessionGrants = new Map<
  string, { tools: Set<string>; expiresAt: number }
>();

/**
 * The agent may spend money and wipe results. Reads and ordinary graph edits
 * stay frictionless (they are undoable), but a run — which costs real credits
 * and overwrites existing media — needs a human yes.
 */
export async function evaluateToolApproval(input: {
  ownerId: string;
  canvasId: string;
  sessionId?: string;
  tool: string;
  args: Record<string, unknown>;
}): Promise<ApprovalCheck> {
  if (input.tool === "canvas_run") {
    if (hasSessionGrant(input, "canvas_run")) {
      return { required: false };
    }
    return {
      required: true,
      ...(await summarizeRun(input.ownerId, input.canvasId, input.args)),
    };
  }

  if (input.tool === "canvas_delete_nodes") {
    const nodeIds = Array.isArray(input.args.nodeIds)
      ? input.args.nodeIds.filter((id): id is string => typeof id === "string")
      : [];
    if (nodeIds.length < DELETE_APPROVAL_THRESHOLD) {
      return { required: false };
    }
    if (hasSessionGrant(input, "canvas_delete_nodes")) {
      return { required: false };
    }
    return {
      required: true,
      summary: `删除 ${nodeIds.length} 个节点`,
      details: { nodes: nodeIds.length },
    };
  }

  return { required: false };
}

async function summarizeRun(
  ownerId: string,
  canvasId: string,
  args: Record<string, unknown>,
): Promise<{ summary: string; details: ApprovalDetails }> {
  const row = await prisma.canvas.findFirst({
    where: { id: canvasId, ownerId },
    select: { graph: true, version: true },
  });
  if (!row) {
    return { summary: "运行画布节点", details: {} };
  }
  const graph = readCanvasGraph(row as never);
  const mode = normalizeRunMode(args.mode);
  const nodeIds = Array.isArray(args.nodeIds)
    ? args.nodeIds.filter((id): id is string => typeof id === "string")
    : [];
  const plan = buildCanvasRunPlan(graph, {
    mode,
    selectedNodeIds: nodeIds,
  });
  const targets = plan?.nodeIds ?? [];
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const overwrite = targets.filter((id) => {
    const node = byId.get(id);
    return Boolean(node?.data.url?.trim()) || node?.data.status === "succeeded";
  }).length;

  const modeLabel =
    mode === "all"
      ? "整个画布"
      : mode === "node"
        ? "选中的节点"
        : mode === "retry-failed"
          ? "失败节点"
          : mode === "from"
            ? "从此节点起"
            : "选中及上游";

  const parts = [`运行 ${targets.length} 个节点（${modeLabel}）`];
  if (overwrite > 0) {
    parts.push(`其中 ${overwrite} 个已有结果，会被覆盖`);
  }
  return {
    summary: parts.join("，"),
    details: { nodes: targets.length, overwrite, mode },
  };
}

function normalizeRunMode(value: unknown): CanvasRunMode {
  return value === "all" ||
    value === "selected" ||
    value === "node" ||
    value === "from" ||
    value === "retry-failed"
    ? value
    : "selected";
}

function grantKey(input: { canvasId: string; sessionId?: string }): string {
  return `${input.canvasId}:${input.sessionId ?? "-"}`;
}

function hasSessionGrant(
  input: { canvasId: string; sessionId?: string },
  tool: string,
): boolean {
  const key = grantKey(input);
  const grant = sessionGrants.get(key);
  if (!grant) {
    return false;
  }
  if (grant.expiresAt < Date.now()) {
    sessionGrants.delete(key);
    return false;
  }
  return grant.tools.has(tool);
}

export function grantSessionTool(input: {
  canvasId: string;
  sessionId?: string;
  tool: string;
}): void {
  const key = grantKey(input);
  const current = sessionGrants.get(key);
  const tools = current ? current.tools : new Set<string>();
  tools.add(input.tool);
  sessionGrants.set(key, {
    tools,
    expiresAt: Date.now() + SESSION_GRANT_TTL_MS,
  });
}

/**
 * Block the turn until the user answers (or the stream is aborted / times out).
 * The decision arrives through `POST /api/agent/approvals/[id]`.
 */
export function requestApproval(input: {
  ownerId: string;
  canvasId: string;
  sessionId?: string;
  tool: string;
  signal?: AbortSignal;
}): { id: string; decision: Promise<ApprovalDecision> } {
  const id = `ap_${crypto.randomUUID()}`;
  const decision = new Promise<ApprovalDecision>((resolve) => {
    let settled = false;
    const finish = (value: ApprovalDecision) => {
      if (settled) {
        return;
      }
      settled = true;
      pending.delete(id);
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", onAbort);
      resolve(value);
    };
    const onAbort = () => finish("deny");
    const timer = setTimeout(() => finish("deny"), APPROVAL_TIMEOUT_MS);
    if (input.signal) {
      if (input.signal.aborted) {
        finish("deny");
        return;
      }
      input.signal.addEventListener("abort", onAbort, { once: true });
    }
    pending.set(id, {
      id,
      ownerId: input.ownerId,
      canvasId: input.canvasId,
      sessionId: input.sessionId,
      tool: input.tool,
      createdAt: Date.now(),
      resolve: finish,
    });
  });
  return { id, decision };
}

/** Returns false when the id is unknown / already settled. */
export function resolveApproval(
  id: string,
  decision: ApprovalDecision,
  actorUserId: string,
): boolean {
  const entry = pending.get(id);
  if (!entry || entry.ownerId !== actorUserId) {
    return false;
  }
  entry.resolve(decision);
  return true;
}

/** Visible for tests. */
export function pendingApprovalCount(): number {
  return pending.size;
}
