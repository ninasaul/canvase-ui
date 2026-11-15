"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCanvasStore, type CanvasFlowEdge, type CanvasFlowNode } from "./canvas-store";

type Snapshot = {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
};

const HISTORY_LIMIT = 50;
const COMMIT_DELAY_MS = 350;

const TRANSIENT_DATA_KEYS = new Set([
  "status",
  "error",
  "startedAt",
  "finishedAt",
  "requestId",
  "taskId",
  "runId",
]);

function comparableData(data: Record<string, unknown>): string {
  const entries = Object.keys(data)
    .filter((key) => !TRANSIENT_DATA_KEYS.has(key))
    .sort()
    .map((key) => [key, data[key]]);
  return JSON.stringify(entries);
}

/**
 * Signatures are cached per node / edge object. Store updates keep the object
 * identity of everything that did not change, so after a drag only the one
 * dragged node needs a JSON pass — the previous version re-serialized the whole
 * graph (100+ nodes) 350 ms after every gesture.
 */
const nodeSignatureCache = new WeakMap<CanvasFlowNode, string>();
const edgeSignatureCache = new WeakMap<CanvasFlowEdge, string>();

function comparableNode(node: CanvasFlowNode): string {
  const cached = nodeSignatureCache.get(node);
  if (cached !== undefined) {
    return cached;
  }
  const signature = JSON.stringify([
    node.id,
    node.type,
    node.parentId ?? "",
    node.position.x,
    node.position.y,
    node.width ?? null,
    node.height ?? null,
    comparableData(node.data as Record<string, unknown>),
  ]);
  nodeSignatureCache.set(node, signature);
  return signature;
}

function comparableEdge(edge: CanvasFlowEdge): string {
  const cached = edgeSignatureCache.get(edge);
  if (cached !== undefined) {
    return cached;
  }
  const signature = JSON.stringify([
    edge.id,
    edge.source,
    edge.target,
    edge.sourceHandle ?? "",
    edge.targetHandle ?? "",
    edge.data?.role ?? "",
    edge.data?.order ?? 0,
  ]);
  edgeSignatureCache.set(edge, signature);
  return signature;
}

function sameHistoryGraph(previous: Snapshot, next: Snapshot): boolean {
  return (
    previous.nodes.length === next.nodes.length &&
    previous.edges.length === next.edges.length &&
    previous.nodes.every((node, index) => {
      const other = next.nodes[index]!;
      return node === other || comparableNode(node) === comparableNode(other);
    }) &&
    previous.edges.every((edge, index) => {
      const other = next.edges[index]!;
      return edge === other || comparableEdge(edge) === comparableEdge(other);
    })
  );
}

/**
 * Debounced snapshot history. Each committed edit pushes the previous graph;
 * undo/redo replaces the current graph without recording another entry.
 *
 * It subscribes to the canvas store directly rather than taking `nodes` /
 * `edges` as arguments: as an argument this hook forced the editor to hold a
 * node subscription (and therefore re-render on every drag frame).
 */
export function useCanvasHistory() {
  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const lastRef = useRef<Snapshot>({
    nodes: useCanvasStore.getState().nodes,
    edges: useCanvasStore.getState().edges,
  });
  const applyingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    function commit() {
      const previous = lastRef.current;
      const next = useCanvasStore.getState();
      if (previous.nodes === next.nodes && previous.edges === next.edges) {
        return;
      }
      if (sameHistoryGraph(previous, { nodes: next.nodes, edges: next.edges })) {
        lastRef.current = { nodes: next.nodes, edges: next.edges };
        return;
      }
      pastRef.current = [
        ...pastRef.current.slice(-(HISTORY_LIMIT - 1)),
        previous,
      ];
      futureRef.current = [];
      lastRef.current = { nodes: next.nodes, edges: next.edges };
      setCanUndo(true);
      setCanRedo(false);
    }

    const unsubscribe = useCanvasStore.subscribe((state, previous) => {
      if (state.nodes === previous.nodes && state.edges === previous.edges) {
        return;
      }
      if (applyingRef.current) {
        applyingRef.current = false;
        lastRef.current = { nodes: state.nodes, edges: state.edges };
        return;
      }
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        commit();
      }, COMMIT_DELAY_MS);
    });

    return () => {
      unsubscribe();
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const undo = useCallback(() => {
    const previous = pastRef.current[pastRef.current.length - 1];
    if (!previous) {
      return;
    }
    const current = useCanvasStore.getState();
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [
      ...futureRef.current,
      { nodes: current.nodes, edges: current.edges },
    ];
    lastRef.current = previous;
    applyingRef.current = true;
    current.replace(previous.nodes, previous.edges);
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    const next = futureRef.current[futureRef.current.length - 1];
    if (!next) {
      return;
    }
    const current = useCanvasStore.getState();
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [
      ...pastRef.current,
      { nodes: current.nodes, edges: current.edges },
    ];
    lastRef.current = next;
    applyingRef.current = true;
    current.replace(next.nodes, next.edges);
    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, [contenteditable='true']")
      ) {
        return;
      }
      event.preventDefault();
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, undo]);

  // Memoized: a fresh object here re-rendered every consumer (the toolbar) on
  // each render of the editor.
  return useMemo(
    () => ({ undo, redo, canUndo, canRedo }),
    [undo, redo, canUndo, canRedo],
  );
}
