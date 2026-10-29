import type {
  CanvasGraph,
  CanvasNodeData,
} from "@/lib/tu-shared-browser";
import {
  CANVAS_RUN_CONCURRENCY,
  buildCanvasRunPlan,
  type CanvasRunMode,
  type CanvasRunPlan,
} from "@/lib/tu-shared-browser";
import { messages } from "@/messages";

export {
  CANVAS_RUN_CONCURRENCY,
  buildCanvasRunPlan,
} from "@/lib/tu-shared-browser";
export type {
  CanvasRunMode,
  CanvasRunPlan,
} from "@/lib/tu-shared-browser";

export type CanvasRunNodeStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "cancelled";

export type CanvasRunResult = {
  succeeded: string[];
  failed: string[];
  skipped: string[];
  cancelled: string[];
};

export async function runCanvasPlan(options: {
  plan: CanvasRunPlan;
  runNode: (nodeId: string, signal: AbortSignal) => Promise<void>;
  update: (nodeId: string, patch: Partial<CanvasNodeData>) => void;
  signal: AbortSignal;
  concurrency?: number;
}): Promise<CanvasRunResult> {
  const { plan, runNode, update, signal } = options;
  const concurrency = Math.max(1, options.concurrency ?? CANVAS_RUN_CONCURRENCY);
  const status = new Map<string, CanvasRunNodeStatus>(
    plan.nodeIds.map((id) => [id, "pending"]),
  );
  const pending = new Set(plan.nodeIds);
  const running = new Map<string, Promise<void>>();
  const result: CanvasRunResult = {
    succeeded: [],
    failed: [],
    skipped: [],
    cancelled: [],
  };

  function terminal(id: string, next: CanvasRunNodeStatus): void {
    status.set(id, next);
    pending.delete(id);
    if (next === "succeeded") result.succeeded.push(id);
    else if (next === "failed") result.failed.push(id);
    else if (next === "skipped") result.skipped.push(id);
    else if (next === "cancelled") result.cancelled.push(id);
  }

  function start(id: string): void {
    status.set(id, "running");
    pending.delete(id);
    update(id, { status: "queued", error: undefined });
    const promise = runNode(id, signal)
      .then(() => {
        terminal(id, "succeeded");
      })
      .catch((error: unknown) => {
        if (signal.aborted) {
          terminal(id, "cancelled");
          update(id, {
            status: "cancelled",
            error: messages.canvas.runCancelledStatus,
          });
          return;
        }
        terminal(id, "failed");
        update(id, {
          status: "failed",
          error:
            error instanceof Error
              ? error.message
              : messages.canvas.runFailed,
        });
      })
      .finally(() => {
        running.delete(id);
      });
    running.set(id, promise);
  }

  while (pending.size > 0 || running.size > 0) {
    if (signal.aborted) {
      for (const id of [...pending]) {
        terminal(id, "cancelled");
        update(id, {
          status: "cancelled",
          error: messages.canvas.runCancelledStatus,
        });
      }
      break;
    }

    let progressed = false;
    for (const id of [...pending]) {
      const deps = plan.dependencies[id] ?? [];
      const blocked = deps.some((dep) => {
        const depStatus = status.get(dep);
        return (
          depStatus === "failed" ||
          depStatus === "skipped" ||
          depStatus === "cancelled"
        );
      });
      if (blocked) {
        terminal(id, "skipped");
        update(id, {
          status: "skipped",
          error: messages.canvas.runSkippedUpstream,
        });
        progressed = true;
        continue;
      }
      const ready = deps.every((dep) => status.get(dep) === "succeeded");
      if (!ready || running.size >= concurrency) {
        continue;
      }
      start(id);
      progressed = true;
    }

    if (!progressed && running.size === 0 && pending.size > 0) {
      for (const id of [...pending]) {
        terminal(id, "skipped");
        update(id, {
          status: "skipped",
          error: messages.canvas.runSkippedDeps,
        });
      }
      break;
    }
    if (running.size > 0) {
      await Promise.race(running.values());
    }
  }

  if (running.size > 0) {
    await Promise.allSettled(running.values());
  }

  return result;
}
