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
  canvasId: string;
  ownerId: string;
  graph: CanvasGraph;
}) {
  const canvas = await getOwnedActiveCanvas(input.canvasId, input.ownerId);
  if (!canvas) {
    return;
  }
  try {
    await applyCanvasGraphUpdate({
      canvasId: input.canvasId,
      ownerId: input.ownerId,
      expectedVersion: canvas.version,
      graph: input.graph,
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
      canvasId: input.canvasId,
      ownerId: input.ownerId,
      graph,
    });
  };

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
      canvasId: input.canvasId,
      ownerId: input.ownerId,
      graph,
    });
  }
}

export async function getCanvasAgentRun(input: {
  runId?: string;
  canvasId: string;
  ownerId: string;
}) {
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
