import { stableGraphJson } from "@/lib/canvas/canvas-graph-json";
import type {
  CanvasGraph,
  CanvasGraphEdge,
  CanvasGraphNode,
} from "@/lib/canvas/canvas-graph";

export type SnapshotMergeResult = {
  graph: CanvasGraph;
  /** Nodes/edges where the local (unsaved) version was kept. */
  keptLocal: number;
  /** Nodes/edges taken from the server snapshot. */
  adoptedRemote: number;
  /** Nodes/edges dropped because the server removed them. */
  dropped: number;
};

function keyOf(value: unknown): string {
  return stableGraphJson(value);
}

/**
 * Three-way merge for adopting a server snapshot into a live editor.
 *
 * `base`   — what we last successfully saved
 * `local`  — current in-memory graph (may contain unsaved edits)
 * `remote` — freshly fetched graph
 *
 * Remote wins only where the local side did not change. Local edits made while
 * an agent was writing are preserved instead of being reverted, and the local
 * selection survives unless the server explicitly changed it.
 */
export function mergeRemoteSnapshot(input: {
  base: CanvasGraph;
  local: CanvasGraph;
  remote: CanvasGraph;
}): SnapshotMergeResult {
  const { base, local, remote } = input;
  const baseNodes = new Map(base.nodes.map((node) => [node.id, node]));
  const localNodes = new Map(local.nodes.map((node) => [node.id, node]));
  const remoteNodes = new Map(remote.nodes.map((node) => [node.id, node]));

  let keptLocal = 0;
  let adoptedRemote = 0;
  let dropped = 0;

  const mergedNodes: CanvasGraphNode[] = [];
  const usedLocal = new Set<string>();

  for (const remoteNode of remote.nodes) {
    const localNode = localNodes.get(remoteNode.id);
    const baseNode = baseNodes.get(remoteNode.id);
    if (!localNode) {
      // Deleted locally. Respect that unless the server changed it meanwhile.
      if (baseNode && keyOf(baseNode) === keyOf(remoteNode)) {
        dropped += 1;
        continue;
      }
      mergedNodes.push(remoteNode);
      adoptedRemote += 1;
      continue;
    }
    const localChanged = !baseNode || keyOf(localNode) !== keyOf(baseNode);
    if (localChanged) {
      mergedNodes.push(localNode);
      usedLocal.add(localNode.id);
      keptLocal += 1;
      continue;
    }
    mergedNodes.push(remoteNode);
    adoptedRemote += 1;
  }

  // Locally created nodes the server has not seen yet.
  for (const localNode of local.nodes) {
    if (usedLocal.has(localNode.id) || remoteNodes.has(localNode.id)) {
      continue;
    }
    if (!baseNodes.has(localNode.id)) {
      mergedNodes.push(localNode);
      keptLocal += 1;
    } else {
      // Existed before, gone from the server: treat as a remote deletion.
      dropped += 1;
    }
  }

  const baseEdges = new Map(base.edges.map((edge) => [edge.id, edge]));
  const localEdges = new Map(local.edges.map((edge) => [edge.id, edge]));
  const remoteEdges = new Map(remote.edges.map((edge) => [edge.id, edge]));
  const mergedEdges: CanvasGraphEdge[] = [];
  const usedEdgeIds = new Set<string>();
  const nodeIds = new Set(mergedNodes.map((node) => node.id));

  for (const remoteEdge of remote.edges) {
    const localEdge = localEdges.get(remoteEdge.id);
    const baseEdge = baseEdges.get(remoteEdge.id);
    if (!localEdge) {
      if (baseEdge && keyOf(baseEdge) === keyOf(remoteEdge)) {
        continue;
      }
      mergedEdges.push(remoteEdge);
      usedEdgeIds.add(remoteEdge.id);
      adoptedRemote += 1;
      continue;
    }
    const localChanged = !baseEdge || keyOf(localEdge) !== keyOf(baseEdge);
    if (localChanged) {
      mergedEdges.push(localEdge);
      usedEdgeIds.add(localEdge.id);
      keptLocal += 1;
      continue;
    }
    mergedEdges.push(remoteEdge);
    usedEdgeIds.add(remoteEdge.id);
    adoptedRemote += 1;
  }

  for (const localEdge of local.edges) {
    if (usedEdgeIds.has(localEdge.id) || remoteEdges.has(localEdge.id)) {
      continue;
    }
    if (baseEdges.has(localEdge.id)) {
      continue;
    }
    // Keep locally created edges only when both endpoints survived.
    if (nodeIds.has(localEdge.source) && nodeIds.has(localEdge.target)) {
      mergedEdges.push(localEdge);
      keptLocal += 1;
    }
  }

  const remoteSelection = remote.selection ?? [];
  const baseSelection = base.selection ?? [];
  const localSelection = local.selection ?? [];
  const remoteChangedSelection =
    keyOf(remoteSelection) !== keyOf(baseSelection);
  const selection = remoteChangedSelection ? remoteSelection : localSelection;

  const settings = remote.settings ?? local.settings;
  return {
    graph: {
      schemaVersion: 1,
      viewport: remote.viewport,
      nodes: mergedNodes,
      edges: mergedEdges,
      ...(settings ? { settings } : {}),
      ...(selection.length > 0 ? { selection } : {}),
    },
    keptLocal,
    adoptedRemote,
    dropped,
  };
}
