"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

import { toast } from "@/components/ui/toast";
import { updateCanvas } from "@/lib/canvas/canvas-api";
import { isCanvasVersionConflict } from "@/lib/canvas/canvas-api";
import { stableGraphJson } from "@/lib/canvas/canvas-graph-json";
import type { CanvasGraph } from "@/lib/canvas/canvas-graph";
import type { CanvasSettings } from "@/lib/tu-shared-browser";
import type {
  CanvasFlowEdge,
  CanvasFlowNode,
} from "@/lib/canvas/canvas-store";
import { messages } from "@/messages";

import {
  sameGraphObservation,
  type CanvasGraphObservation,
} from "../lib/observation";

/**
 * Save pipeline: dirty tracking, the debounced autosave effect, retries and the
 * before-unload guard. The editor still owns snapshot adoption and conflicts,
 * so the refs it needs are returned.
 */
export function useCanvasDocument(input: {
  canvasId: string;
  initial: { version: number; title: string; updatedAt: string };
  toGraph: () => CanvasGraph;
  titleRef: MutableRefObject<string>;
  tryRebase: () => Promise<boolean>;
  /** Values observed by the autosave effect. */
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  settings: CanvasSettings;
  title: string;
  runActive: boolean;
  serverRunId: string | null;
}) {
  const {
    canvasId,
    initial,
    toGraph,
    titleRef,
    tryRebase,
    nodes,
    edges,
    settings,
    title,
    runActive,
    serverRunId,
  } = input;

  const [version, setVersion] = useState(initial.version);
  const [savedAt, setSavedAt] = useState(initial.updatedAt);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState(false);

  const versionRef = useRef(initial.version);
  const lastSavedRef = useRef({
    title: initial.title,
    graph: stableGraphJson(initialGraphJson(toGraph)),
  });
  const graphObservationRef = useRef<CanvasGraphObservation | null>(null);
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const conflictRef = useRef(false);
  const dirtyRef = useRef(false);
  const initialAutosaveSkippedRef = useRef(false);
  const flushSaveRef = useRef<() => Promise<void>>(async () => undefined);

  const markDirty = useCallback((value: boolean) => {
    dirtyRef.current = value;
    setDirty(value);
  }, []);

  const flushSave = useCallback(async () => {
    if (inFlightRef.current) {
      pendingRef.current = true;
      return;
    }
    if (conflictRef.current) {
      return;
    }
    const currentTitle = titleRef.current;
    const graph = toGraph();
    const graphJson = stableGraphJson(graph);
    if (
      currentTitle === lastSavedRef.current.title &&
      graphJson === lastSavedRef.current.graph
    ) {
      markDirty(false);
      return;
    }

    inFlightRef.current = true;
    pendingRef.current = false;
    setSaving(true);
    const versionForSave = versionRef.current;
    try {
      const saved = await updateCanvas(canvasId, {
        version: versionForSave,
        title: currentTitle,
        graph,
      });
      lastSavedRef.current = {
        title: saved.title,
        graph: stableGraphJson(saved.graph),
      };
      versionRef.current = saved.version;
      setVersion(saved.version);
      setSavedAt(saved.updatedAt);
      setConflict(false);
      conflictRef.current = false;
      retryCountRef.current = 0;
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      const latestGraph = stableGraphJson(toGraph());
      const dirtyAfterSave =
        titleRef.current !== saved.title ||
        latestGraph !== lastSavedRef.current.graph;
      markDirty(dirtyAfterSave);
    } catch (error: unknown) {
      if (isCanvasVersionConflict(error)) {
        // Retry once the stale version is replaced, but only when the server
        // content still matches what we last saved (no real divergence).
        if (await tryRebase()) {
          pendingRef.current = true;
          return;
        }
        conflictRef.current = true;
        setConflict(true);
        markDirty(true);
        return;
      }
      markDirty(true);
      toast.danger(
        error instanceof Error ? error.message : messages.canvas.saveFailed,
      );
      retryCountRef.current += 1;
      const delay = Math.min(
        8000,
        1000 * 2 ** Math.min(retryCountRef.current - 1, 3),
      );
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
      }
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        void flushSaveRef.current();
      }, delay);
    } finally {
      inFlightRef.current = false;
      setSaving(false);
      if (!conflictRef.current && pendingRef.current) {
        pendingRef.current = false;
        void flushSaveRef.current();
      }
    }
  }, [canvasId, markDirty, titleRef, toGraph, tryRebase]);

  useEffect(() => {
    flushSaveRef.current = flushSave;
  }, [flushSave]);

  useEffect(() => {
    if (
      runActive ||
      serverRunId ||
      nodes.some(
        (node) =>
          Boolean(node.data.runId) &&
          (node.data.status === "running" || node.data.status === "queued"),
      )
    ) {
      return;
    }
    if (!initialAutosaveSkippedRef.current) {
      initialAutosaveSkippedRef.current = true;
      graphObservationRef.current = { nodes, edges, settings, title };
      return;
    }
    if (conflict) {
      return;
    }
    const observation = { nodes, edges, settings, title };
    const previous = graphObservationRef.current;
    graphObservationRef.current = observation;
    if (previous && sameGraphObservation(previous, observation)) {
      return;
    }
    if (!previous) {
      return;
    }
    markDirty(true);
    if (inFlightRef.current) {
      pendingRef.current = true;
      return;
    }
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void flushSaveRef.current();
    }, 800);
  }, [conflict, edges, markDirty, nodes, runActive, serverRunId, settings, title]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return {
    version,
    setVersion,
    versionRef,
    savedAt,
    setSavedAt,
    saving,
    dirty,
    conflict,
    setConflict,
    conflictRef,
    dirtyRef,
    inFlightRef,
    lastSavedRef,
    graphObservationRef,
    markDirty,
    flushSave,
    flushSaveRef,
  };
}

/** Canonical JSON of the graph as it stands when the editor mounts. */
function initialGraphJson(toGraph: () => CanvasGraph): CanvasGraph {
  try {
    return toGraph();
  } catch {
    return { schemaVersion: 1, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [], edges: [] };
  }
}
