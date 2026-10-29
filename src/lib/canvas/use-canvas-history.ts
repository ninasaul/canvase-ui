"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasFlowEdge, CanvasFlowNode } from "./canvas-store";

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

function comparableNode(node: CanvasFlowNode): string {
  return JSON.stringify([
    node.id,
    node.type,
    node.parentId ?? "",
    node.position.x,
    node.position.y,
    node.width ?? null,
    node.height ?? null,
    comparableData(node.data as Record<string, unknown>),
  ]);
}

function comparableEdge(edge: CanvasFlowEdge): string {
  return JSON.stringify([
    edge.id,
    edge.source,
    edge.target,
    edge.sourceHandle ?? "",
    edge.targetHandle ?? "",
    edge.data?.role ?? "",
    edge.data?.order ?? 0,
  ]);
}

function sameHistoryGraph(
  previous: Snapshot,
  next: Snapshot,
): boolean {
  return (
    previous.nodes.length === next.nodes.length &&
    previous.edges.length === next.edges.length &&
    previous.nodes.every(
      (node, index) => comparableNode(node) === comparableNode(next.nodes[index]!),
    ) &&
    previous.edges.every(
      (edge, index) => comparableEdge(edge) === comparableEdge(next.edges[index]!),
    )
  );
}

/**
 * Debounced snapshot history. Each committed edit pushes the previous graph;
 * undo/redo replaces the current graph without recording another entry.
 */
export function useCanvasHistory(options: {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  apply: (nodes: CanvasFlowNode[], edges: CanvasFlowEdge[]) => void;
}) {
  const { nodes, edges, apply } = options;
  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const lastRef = useRef<Snapshot>({ nodes, edges });
  const applyingRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    if (applyingRef.current) {
      applyingRef.current = false;
      lastRef.current = { nodes, edges };
      return;
    }
    const timer = window.setTimeout(() => {
      const previous = lastRef.current;
      if (previous.nodes === nodes && previous.edges === edges) {
        return;
      }
      if (sameHistoryGraph(previous, { nodes, edges })) {
        lastRef.current = { nodes, edges };
        return;
      }
      pastRef.current = [...pastRef.current.slice(-(HISTORY_LIMIT - 1)), previous];
      futureRef.current = [];
      lastRef.current = { nodes, edges };
      setCanUndo(true);
      setCanRedo(false);
    }, COMMIT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [edges, nodes]);

  const undo = useCallback(() => {
    const previous = pastRef.current[pastRef.current.length - 1];
    if (!previous) {
      return;
    }
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, { nodes, edges }];
    lastRef.current = previous;
    applyingRef.current = true;
    apply(previous.nodes, previous.edges);
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(true);
  }, [apply, edges, nodes]);

  const redo = useCallback(() => {
    const next = futureRef.current[futureRef.current.length - 1];
    if (!next) {
      return;
    }
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current, { nodes, edges }];
    lastRef.current = next;
    applyingRef.current = true;
    apply(next.nodes, next.edges);
    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);
  }, [apply, edges, nodes]);

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

  return {
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
