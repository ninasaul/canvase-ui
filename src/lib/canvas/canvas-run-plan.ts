import type {
  CanvasGraph,
  CanvasGraphNode,
} from "./canvas-graph";
import { messages } from "@/messages";

export const CANVAS_RUN_CONCURRENCY = 2;

export type CanvasRunMode = "all" | "selected" | "from" | "retry-failed";

export type CanvasRunPlan = {
  mode: CanvasRunMode;
  nodeIds: string[];
  layers: string[][];
  dependencies: Record<string, string[]>;
};

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

const EXECUTABLE = new Set(["image", "video"]);

function executable(node: CanvasGraphNode): boolean {
  if (EXECUTABLE.has(node.type)) {
    return true;
  }
  return (
    node.type === "text" &&
    Boolean(node.data.model?.trim()) &&
    Boolean(node.data.prompt?.trim() || node.data.text?.trim())
  );
}

function executableId(
  id: string,
  byId: Map<string, CanvasGraphNode>,
): boolean {
  const node = byId.get(id);
  return Boolean(node && executable(node));
}

function nodeMap(graph: CanvasGraph): Map<string, CanvasGraphNode> {
  return new Map(graph.nodes.map((node) => [node.id, node]));
}

function incomingMap(graph: CanvasGraph): Map<string, string[]> {
  const incoming = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = incoming.get(edge.target) ?? [];
    list.push(edge.source);
    incoming.set(edge.target, list);
  }
  return incoming;
}

function outgoingMap(graph: CanvasGraph): Map<string, string[]> {
  const outgoing = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge.target);
    outgoing.set(edge.source, list);
  }
  return outgoing;
}

function collectAncestors(
  start: string[],
  incoming: Map<string, string[]>,
): Set<string> {
  const seen = new Set<string>();
  const stack = [...start];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    stack.push(...(incoming.get(id) ?? []));
  }
  return seen;
}

function collectDescendants(
  start: string[],
  outgoing: Map<string, string[]>,
): Set<string> {
  const seen = new Set<string>();
  const stack = [...start];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    stack.push(...(outgoing.get(id) ?? []));
  }
  return seen;
}

export function buildCanvasRunPlan(
  graph: CanvasGraph,
  options: {
    mode: CanvasRunMode;
    selectedNodeIds?: string[];
    fromNodeIds?: string[];
  },
): CanvasRunPlan | null {
  const byId = nodeMap(graph);
  const incoming = incomingMap(graph);
  const outgoing = outgoingMap(graph);
  const selected = (options.selectedNodeIds ?? []).filter((id) =>
    executableId(id, byId),
  );
  const from = (options.fromNodeIds ?? []).filter((id) =>
    executableId(id, byId),
  );

  let included: Set<string>;
  if (options.mode === "all") {
    included = new Set(graph.nodes.filter(executable).map((node) => node.id));
  } else if (options.mode === "selected") {
    included = collectAncestors(selected, incoming);
  } else if (options.mode === "from") {
    included = collectDescendants(from, outgoing);
  } else {
    const failed = graph.nodes
      .filter(
        (node) =>
          executable(node) &&
          (node.data.status === "failed" ||
            node.data.status === "cancelled" ||
            node.data.status === "interrupted"),
      )
      .map((node) => node.id);
    const downstream = collectDescendants(failed, outgoing);
    included = new Set(
      [...new Set([...failed, ...downstream])].filter((id) => {
        const node = byId.get(id);
        return Boolean(
          node &&
            executable(node) &&
            node.data.status !== "succeeded",
        );
      }),
    );
  }

  // Only executable nodes are runnable; text/audio remain static inputs.
  included = new Set([...included].filter((id) => {
    const node = byId.get(id);
    return Boolean(node && executable(node));
  }));
  if (included.size === 0) {
    return null;
  }

  const dependencies: Record<string, string[]> = {};
  for (const id of included) {
    dependencies[id] = (incoming.get(id) ?? []).filter((source) =>
      included.has(source),
    );
  }

  const remaining = new Set(included);
  const layers: string[][] = [];
  while (remaining.size > 0) {
    const layer = [...remaining].filter((id) =>
      (dependencies[id] ?? []).every((source) => !remaining.has(source)),
    );
    if (layer.length === 0) {
      throw new Error(messages.canvas.runCycleDetected);
    }
    layers.push(layer);
    for (const id of layer) {
      remaining.delete(id);
    }
  }

  return {
    mode: options.mode,
    layers,
    nodeIds: layers.flat(),
    dependencies,
  };
}

