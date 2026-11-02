import { estimateCanvasGenerationCost, formatCanvasCost } from "@/lib/canvas/canvas-generation-cost";
import type { CanvasRunPlan } from "@/lib/canvas/canvas-run-plan";
import type { CanvasFlowNode } from "@/lib/canvas/canvas-store";
import { messages } from "@/messages";

import { costToCents } from "./cost";
import { nodeTypeLabel } from "./node-display";

export type RunConfirmState = {
  mode: string;
  plan: CanvasRunPlan;
  selectedNodeIds: string[];
  includeUpstream: boolean;
};

/** Selected ids plus the children of selected groups (they travel together). */
export function expandSelectedIds(
  selectedNodeIds: string[],
  nodes: CanvasFlowNode[],
): Set<string> {
  const selected = new Set(selectedNodeIds);
  for (const node of nodes) {
    if (node.parentId && selected.has(node.parentId)) {
      selected.add(node.id);
    }
  }
  return selected;
}

/** Aggregates shown in the run dialog header. */
export function summarizeRunPlan(
  runConfirm: RunConfirmState,
  nodes: CanvasFlowNode[],
) {
  const selected = expandSelectedIds(runConfirm.selectedNodeIds, nodes);
  // "Upstream" only means something when the plan pulled extra nodes in.
  const trackUpstream =
    runConfirm.mode === "selected" && runConfirm.includeUpstream;
  const byId = new Map(nodes.map((node) => [node.id, node]));

  let overwrite = 0;
  let upstream = 0;
  const byType: Record<string, number> = {};
  for (const nodeId of runConfirm.plan.nodeIds) {
    const node = byId.get(nodeId);
    if (!node) {
      continue;
    }
    if (node.data.url?.trim() || node.data.status === "succeeded") {
      overwrite += 1;
    }
    byType[node.type ?? "text"] = (byType[node.type ?? "text"] ?? 0) + 1;
    if (trackUpstream && !selected.has(nodeId)) {
      upstream += 1;
    }
  }
  return {
    count: runConfirm.plan.nodeIds.length,
    overwrite,
    upstream,
    byType,
  };
}

/** Execution order, but spatial within a layer (top-left first). */
export function orderRunPlanNodes(
  runConfirm: RunConfirmState,
  nodes: CanvasFlowNode[],
): string[] {
  const position = new Map(nodes.map((node) => [node.id, node.position]));
  const order = new Map<string, number>();
  let index = 0;
  for (const layer of runConfirm.plan.layers) {
    const sorted = [...layer].sort((a, b) => {
      const pa = position.get(a);
      const pb = position.get(b);
      return (pa?.y ?? 0) - (pb?.y ?? 0) || (pa?.x ?? 0) - (pb?.x ?? 0);
    });
    for (const id of sorted) {
      order.set(id, index);
      index += 1;
    }
  }
  return [...runConfirm.plan.nodeIds].sort(
    (a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0),
  );
}

export type RunPlanRow = {
  id: string;
  label: string;
  type: string;
  meta: string;
  hasResult: boolean;
  isUpstream: boolean;
};

/** Rows for the dialog table; the caller decides how many to show. */
export function buildRunPlanRows(input: {
  runConfirm: RunConfirmState;
  nodes: CanvasFlowNode[];
  order: string[];
  limit: number;
}): RunPlanRow[] {
  const { runConfirm, nodes, order, limit } = input;
  const selected = expandSelectedIds(runConfirm.selectedNodeIds, nodes);
  const trackUpstream =
    runConfirm.mode === "selected" && runConfirm.includeUpstream;
  const byId = new Map(nodes.map((node) => [node.id, node]));

  return order.slice(0, limit).flatMap((nodeId) => {
    const node = byId.get(nodeId);
    if (!node) {
      return [];
    }
    const params = node.data.params ?? {};
    const size =
      typeof params.size === "string"
        ? params.size
        : typeof params.aspectRatio === "string"
          ? params.aspectRatio
          : "";
    const duration =
      typeof params.duration === "string" ||
      typeof params.duration === "number"
        ? `${params.duration}s`
        : "";
    const meta = [node.data.model, duration || size]
      .filter((value): value is string => Boolean(value))
      .join(" · ");
    return [
      {
        id: nodeId,
        label: node.data.label?.trim() || nodeTypeLabel(node.type),
        type: node.type ?? "text",
        meta: meta || messages.canvas.noModel,
        hasResult: Boolean(
          node.data.url?.trim() || node.data.status === "succeeded",
        ),
        isUpstream: trackUpstream && !selected.has(nodeId),
      },
    ];
  });
}

type PricedModel = {
  id: string;
  vendor?: string;
  pricing?: Parameters<typeof estimateCanvasGenerationCost>[0];
};

/** Sums configured model prices; unpriced nodes are counted separately. */
export function estimateRunCost(input: {
  runConfirm: RunConfirmState;
  nodes: CanvasFlowNode[];
  models: PricedModel[];
}): { total: string; priced: number; unpriced: number } {
  const { runConfirm, nodes, models } = input;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let cents = BigInt(0);
  let priced = 0;
  let unpriced = 0;

  for (const nodeId of runConfirm.plan.nodeIds) {
    const node = byId.get(nodeId);
    if (!node || (node.type !== "image" && node.type !== "video")) {
      unpriced += 1;
      continue;
    }
    const modelId = node.data.model?.trim() ?? "";
    const model =
      models.find(
        (item) =>
          item.id === modelId &&
          (!node.data.vendor || item.vendor === node.data.vendor),
      ) ?? models.find((item) => item.id === modelId);
    const estimate = estimateCanvasGenerationCost(
      model?.pricing,
      node.type,
      node.data.params as Record<string, unknown> | undefined,
    );
    if (estimate === null) {
      unpriced += 1;
      continue;
    }
    cents += costToCents(estimate);
    priced += 1;
  }

  return { total: formatCanvasCost(cents * 10_000n), priced, unpriced };
}
