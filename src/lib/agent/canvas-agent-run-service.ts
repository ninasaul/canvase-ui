import { Prisma } from "@prisma/client";
import {
  applyCanvasGraphUpdate,
  getOwnedActiveCanvas,
  readCanvasGraph,
} from "@/lib/canvas/apply-canvas-graph-update";
import {
  buildCanvasRunPlan,
  runCanvasPlan,
  type CanvasRunMode,
} from "@/lib/canvas/canvas-dag-runner";
import type { CanvasGraph, CanvasNodeData } from "@/lib/canvas/canvas-graph";
import {
  runCanvasImageNode,
  runCanvasTextNode,
  runCanvasVideoNode,
} from "@/lib/canvas/canvas-runner";
import { resolveNodeThumbnailPatch } from "@/lib/agent/canvas-thumbnail-resolve";
import { writeCommandLogSafe } from "@/lib/agent/canvas-command-log";
import { resolveUserGenerationConnection } from "@/lib/generation/generation-config-server";
import { prisma } from "@/lib/prisma";
import { messages } from "@/messages";

export type AgentRunNodeState = {
  status:
    | "pending"
    | "queued"
    | "running"
    | "succeeded"
    | "failed"
    | "skipped"
    | "cancelled";
  error?: string;
  requestId?: string;
  outputUrl?: string;
};

type NodeStatesMap = Record<string, AgentRunNodeState>;

const activeControllers = new Map<string, AbortController>();

/** Heartbeat cadence while a run executes in this process. */
const RUN_HEARTBEAT_MS = 30_000;
/** A run with no heartbeat for this long is considered abandoned. */
const RUN_STALE_MS = 90_000;

/**
 * Runs execute in-process, so a restart (or another instance) leaves rows stuck
 * in `queued` / `running` forever. Heartbeats keep `updatedAt` fresh; anything
 * older than {@link RUN_STALE_MS} without a live controller is marked failed.
 */
export async function sweepStaleCanvasAgentRuns(input: {
  canvasId: string;
  ownerId: string;
}): Promise<void> {
  const cutoff = new Date(Date.now() - RUN_STALE_MS);
  const stale = await prisma.canvasAgentRun.findMany({
    where: {
      canvasId: input.canvasId,
      ownerId: input.ownerId,
      status: { in: ["queued", "running"] },
      updatedAt: { lt: cutoff },
    },
    select: { id: true },
  });
  const abandoned = stale.filter((row) => !activeControllers.has(row.id));
  if (abandoned.length === 0) {
    return;
  }
  await prisma.canvasAgentRun.updateMany({
    where: { id: { in: abandoned.map((row) => row.id) } },
    data: {
      status: "failed",
      error: "Run interrupted (server restarted or worker lost)",
      finishedAt: new Date(),
    },
  });
}

function asNodeStates(value: unknown): NodeStatesMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as NodeStatesMap;
}

function summarizeRun(row: {
  id: string;
  canvasId: string;
  mode: string;
  status: string;
  nodeIds: string[];
  nodeStates: unknown;
  error: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    runId: row.id,
    canvasId: row.canvasId,
    mode: row.mode,
    status: row.status,
    nodeIds: row.nodeIds,
    nodes: asNodeStates(row.nodeStates),
    error: row.error,
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function persistNodeStates(
  runId: string,
  nodeStates: NodeStatesMap,
  patch?: {
    status?: "queued" | "running" | "succeeded" | "partial" | "failed" | "cancelled";
    error?: string | null;
    startedAt?: Date | null;
    finishedAt?: Date | null;
  },
) {
  await prisma.canvasAgentRun.update({
    where: { id: runId },
    data: {
      nodeStates: nodeStates as Prisma.InputJsonValue,
      ...(patch?.status ? { status: patch.status } : {}),
      ...(patch && "error" in patch ? { error: patch.error } : {}),
      ...(patch && "startedAt" in patch ? { startedAt: patch.startedAt } : {}),
      ...(patch && "finishedAt" in patch ? { finishedAt: patch.finishedAt } : {}),
    },
  });
}

async function persistGraphSnapshot(input: {
  runId: string;
  canvasId: string;
  ownerId: string;
  graph: CanvasGraph;
}) {
  const canvas = await getOwnedActiveCanvas(input.canvasId, input.ownerId);
  if (!canvas) {
    return;
  }
  try {
    const applied = await applyCanvasGraphUpdate({
      canvasId: input.canvasId,
      ownerId: input.ownerId,
      expectedVersion: canvas.version,
      graph: input.graph,
    });
    // Snapshots bump the canvas version outside of a tool call. Log them so an
    // editor save conflict can always be traced back to a writer.
    writeCommandLogSafe({
      canvasId: input.canvasId,
      actorType: "agent",
      actorId: input.runId,
      tool: "canvas_run_snapshot",
      args: { runId: input.runId },
      result: { snapshot: true },
      versionBefore: applied.versionBefore,
      versionAfter: applied.versionAfter,
    });
  } catch {
    // Version conflict while UI also saves — next node / final write retries.
  }
}

function patchGraphNode(
  graph: CanvasGraph,
  nodeId: string,
  patch: Partial<CanvasNodeData>,
): CanvasGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, ...patch } }
        : node,
    ),
  };
}

export async function startCanvasAgentRun(input: {
  canvasId: string;
  ownerId: string;
  mode: CanvasRunMode;
  nodeIds?: string[];
}): Promise<ReturnType<typeof summarizeRun>> {
  const existing = await prisma.canvasAgentRun.findFirst({
    where: {
      canvasId: input.canvasId,
      ownerId: input.ownerId,
      status: { in: ["queued", "running"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    throw new Error(messages.canvas.runAlreadyRunning);
  }

  const canvas = await getOwnedActiveCanvas(input.canvasId, input.ownerId);
  if (!canvas) {
    throw new Error("Canvas not found");
  }
  const graph = readCanvasGraph(canvas);
  const selectedNodeIds = input.nodeIds ?? graph.selection ?? [];
  const plan = buildCanvasRunPlan(graph, {
    mode: input.mode,
    selectedNodeIds,
    fromNodeIds: selectedNodeIds,
  });
  if (!plan) {
    throw new Error(
      input.mode === "retry-failed"
        ? messages.canvas.runNoFailed
        : input.mode === "all"
          ? messages.canvas.runNoNodes
          : messages.canvas.runSelectNode,
    );
  }

  const nodeStates: NodeStatesMap = {};
  for (const nodeId of plan.nodeIds) {
    nodeStates[nodeId] = { status: "pending" };
  }

  const row = await prisma.canvasAgentRun.create({
    data: {
      canvasId: input.canvasId,
      ownerId: input.ownerId,
      mode: input.mode,
      status: "queued",
      nodeIds: plan.nodeIds,
      nodeStates: nodeStates as Prisma.InputJsonValue,
    },
  });

  const controller = new AbortController();
  activeControllers.set(row.id, controller);

  void executeAgentRun({
    runId: row.id,
    canvasId: input.canvasId,
    ownerId: input.ownerId,
    planNodeIds: plan.nodeIds,
    mode: input.mode,
    selectedNodeIds,
    signal: controller.signal,
  }).finally(() => {
    activeControllers.delete(row.id);
  });

  return summarizeRun(row);
}

async function executeAgentRun(input: {
  runId: string;
  canvasId: string;
  ownerId: string;
  planNodeIds: string[];
  mode: CanvasRunMode;
  selectedNodeIds: string[];
  signal: AbortSignal;
}) {
  let graph = readCanvasGraph(
    (await getOwnedActiveCanvas(input.canvasId, input.ownerId))!,
  );
  const plan = buildCanvasRunPlan(graph, {
    mode: input.mode,
    selectedNodeIds: input.selectedNodeIds,
    fromNodeIds: input.selectedNodeIds,
  });
  if (!plan) {
    await persistNodeStates(input.runId, {}, {
      status: "failed",
      error: messages.canvas.runNoNodes,
      finishedAt: new Date(),
    });
    return;
  }

  const nodeStates: NodeStatesMap = {};
  for (const nodeId of plan.nodeIds) {
    nodeStates[nodeId] = { status: "queued" };
    graph = patchGraphNode(graph, nodeId, {
      status: "queued",
      error: undefined,
      finishedAt: undefined,
    });
  }
  await persistNodeStates(input.runId, nodeStates, {
    status: "running",
    startedAt: new Date(),
    error: null,
  });
  await persistGraphSnapshot({
    runId: input.runId,
    canvasId: input.canvasId,
    ownerId: input.ownerId,
    graph,
  });

  const applyUpdate = (nodeId: string, patch: Partial<CanvasNodeData>) => {
    graph = patchGraphNode(graph, nodeId, patch);
    const previous = nodeStates[nodeId] ?? { status: "pending" as const };
    const nextStatus =
      patch.status && patch.status !== "idle"
        ? (patch.status as AgentRunNodeState["status"])
        : previous.status;
    nodeStates[nodeId] = {
      ...previous,
      status: nextStatus,
      ...(patch.error !== undefined ? { error: patch.error || undefined } : {}),
      ...(patch.requestId ? { requestId: patch.requestId } : {}),
      ...(typeof patch.url === "string" && patch.url
        ? { outputUrl: patch.url }
        : {}),
    };
    void persistNodeStates(input.runId, nodeStates);
    void persistGraphSnapshot({
      runId: input.runId,
      canvasId: input.canvasId,
      ownerId: input.ownerId,
      graph,
    });
  };

  // Keep `updatedAt` fresh so the stale-run sweeper can tell a live run from
  // an abandoned one after a restart.
  const heartbeat = setInterval(() => {
    void prisma.canvasAgentRun
      .update({
        where: { id: input.runId },
        data: { updatedAt: new Date() },
      })
      .catch(() => undefined);
  }, RUN_HEARTBEAT_MS);
  heartbeat.unref?.();

  try {
    const result = await runCanvasPlan({
      plan,
      signal: input.signal,
      concurrency: 2,
      update: applyUpdate,
      runNode: async (nodeId, signal) => {
        const node = graph.nodes.find((item) => item.id === nodeId);
        if (!node) {
          throw new Error(messages.canvas.nodeMissing);
        }
        const connection = await resolveUserGenerationConnection(
          input.ownerId,
          {
            vendorId: node.data.vendor,
            modelId: node.data.model,
          },
        );
        if (!connection.baseUrl && !connection.apiKey) {
          throw new Error(messages.canvas.generationMissing);
        }
        const generation = {
          baseUrl: connection.baseUrl || undefined,
          apiKey: connection.apiKey || undefined,
          vendorId: connection.vendorId || undefined,
        };
        const apiKey = connection.apiKey;
        if (node.type === "image") {
          await runCanvasImageNode({
            nodeId,
            graph,
            apiKey,
            update: applyUpdate,
            signal,
            generation,
          });
          const after = graph.nodes.find((item) => item.id === nodeId);
          if (after) {
            const thumb = await resolveNodeThumbnailPatch(
              input.ownerId,
              after.data,
            );
            if (thumb.thumbnailUrl) {
              applyUpdate(nodeId, { thumbnailUrl: thumb.thumbnailUrl });
            }
          }
          return;
        }
        if (node.type === "video") {
          await runCanvasVideoNode({
            nodeId,
            graph,
            apiKey,
            update: applyUpdate,
            signal,
            generation,
          });
          const after = graph.nodes.find((item) => item.id === nodeId);
          if (after) {
            const thumb = await resolveNodeThumbnailPatch(
              input.ownerId,
              after.data,
            );
            if (thumb.thumbnailUrl) {
              applyUpdate(nodeId, { thumbnailUrl: thumb.thumbnailUrl });
            }
          }
          return;
        }
        if (node.type === "text") {
          await runCanvasTextNode({
            nodeId,
            graph,
            apiKey,
            update: applyUpdate,
            signal,
            generation,
          });
          return;
        }
        throw new Error(messages.canvas.runNoNodes);
      },
    });

    const status = input.signal.aborted
      ? "cancelled"
      : result.failed.length > 0 || result.skipped.length > 0
        ? result.succeeded.length > 0
          ? "partial"
          : "failed"
        : "succeeded";

    await persistNodeStates(input.runId, nodeStates, {
      status,
      finishedAt: new Date(),
      error: input.signal.aborted ? messages.canvas.runCancelled : null,
    });
    await persistGraphSnapshot({
      runId: input.runId,
      canvasId: input.canvasId,
      ownerId: input.ownerId,
      graph,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : messages.canvas.runFailed;
    await persistNodeStates(input.runId, nodeStates, {
      status: input.signal.aborted ? "cancelled" : "failed",
      error: message,
      finishedAt: new Date(),
    });
    await persistGraphSnapshot({
      runId: input.runId,
      canvasId: input.canvasId,
      ownerId: input.ownerId,
      graph,
    });
  } finally {
    clearInterval(heartbeat);
  }
}

export async function getCanvasAgentRun(input: {
  runId?: string;
  canvasId: string;
  ownerId: string;
}) {
  await sweepStaleCanvasAgentRuns(input).catch(() => undefined);
  if (input.runId) {
    const row = await prisma.canvasAgentRun.findFirst({
      where: {
        id: input.runId,
        canvasId: input.canvasId,
        ownerId: input.ownerId,
      },
    });
    return row ? summarizeRun(row) : null;
  }
  const row = await prisma.canvasAgentRun.findFirst({
    where: {
      canvasId: input.canvasId,
      ownerId: input.ownerId,
    },
    orderBy: { createdAt: "desc" },
  });
  return row ? summarizeRun(row) : null;
}

export async function getActiveCanvasAgentRun(input: {
  canvasId: string;
  ownerId: string;
}) {
  await sweepStaleCanvasAgentRuns(input).catch(() => undefined);
  const row = await prisma.canvasAgentRun.findFirst({
    where: {
      canvasId: input.canvasId,
      ownerId: input.ownerId,
      status: { in: ["queued", "running"] },
    },
    orderBy: { createdAt: "desc" },
  });
  return row ? summarizeRun(row) : null;
}

export async function cancelCanvasAgentRun(input: {
  runId: string;
  canvasId: string;
  ownerId: string;
}) {
  const row = await prisma.canvasAgentRun.findFirst({
    where: {
      id: input.runId,
      canvasId: input.canvasId,
      ownerId: input.ownerId,
    },
  });
  if (!row) {
    throw new Error("Run not found");
  }
  if (row.status !== "queued" && row.status !== "running") {
    return summarizeRun(row);
  }
  const controller = activeControllers.get(row.id);
  controller?.abort();
  const updated = await prisma.canvasAgentRun.update({
    where: { id: row.id },
    data: {
      status: "cancelled",
      error: messages.canvas.runCancelled,
      finishedAt: new Date(),
    },
  });
  return summarizeRun(updated);
}
