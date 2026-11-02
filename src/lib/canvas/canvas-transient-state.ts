import type { CanvasNodeData } from "@/lib/canvas/canvas-graph";

export type TransientNodeFields = Partial<
  Pick<
    CanvasNodeData,
    "status" | "error" | "requestId" | "taskId" | "startedAt" | "finishedAt"
  >
>;

type NodeLike = { id: string; data: CanvasNodeData };

const LIVE_STATUSES = new Set(["running", "queued"]);

/**
 * Local generation runs keep their live status in the in-memory store; the
 * server graph only learns about it on the next autosave (which is paused
 * while a run is active). Before adopting a server snapshot, capture the
 * transient fields of nodes that are still running so the swap does not make
 * the canvas look idle.
 */
export function captureTransientNodeState(
  nodes: readonly NodeLike[],
): Map<string, TransientNodeFields> {
  const captured = new Map<string, TransientNodeFields>();
  for (const node of nodes) {
    const status = node.data.status;
    if (!status || !LIVE_STATUSES.has(status)) {
      continue;
    }
    captured.set(node.id, {
      status,
      ...(node.data.error !== undefined ? { error: node.data.error } : {}),
      ...(node.data.requestId ? { requestId: node.data.requestId } : {}),
      ...(node.data.taskId ? { taskId: node.data.taskId } : {}),
      ...(typeof node.data.startedAt === "number"
        ? { startedAt: node.data.startedAt }
        : {}),
      ...(typeof node.data.finishedAt === "number"
        ? { finishedAt: node.data.finishedAt }
        : {}),
    });
  }
  return captured;
}

/** Terminal states always win over a stale "running" held in memory. */
const TERMINAL_STATUSES = new Set([
  "succeeded",
  "failed",
  "cancelled",
  "interrupted",
]);

/** Re-apply captured live fields onto freshly loaded nodes of the same ids. */
export function applyTransientNodeState<T extends NodeLike>(
  nodes: readonly T[],
  captured: ReadonlyMap<string, TransientNodeFields>,
): T[] {
  if (captured.size === 0) {
    return [...nodes];
  }
  return nodes.map((node) => {
    const patch = captured.get(node.id);
    if (!patch) {
      return node;
    }
    const incoming = node.data.status;
    if (
      typeof incoming === "string" &&
      TERMINAL_STATUSES.has(incoming)
    ) {
      // The server finished this node (agent run, background run) — do not
      // resurrect the local "running" flag.
      return node;
    }
    return { ...node, data: { ...node.data, ...patch } };
  });
}
