"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

import { toast } from "@/components/ui/toast";
import {
  recordCanvasRun,
  cancelAgentRun,
  cancelCanvasRun,
  getActiveAgentRun,
  getActiveCanvasRun,
  getCanvasRun,
} from "@/lib/canvas/canvas-api";
import type { AgentRunNodeStateView } from "@/lib/canvas/canvas-api";
import type { CanvasNodeRunStatus } from "@/lib/tu-shared-browser";
import {
  runCanvasPlan,
} from "@/lib/canvas/canvas-dag-runner";
import {
  runCanvasImageNode,
  runCanvasTextNode,
  runCanvasVideoNode,
} from "@/lib/canvas/canvas-runner";
import { useCanvasStore } from "@/lib/canvas/canvas-store";
import { useCanvasRunStatusStore } from "@/lib/canvas/canvas-run-status-store";
import type { CanvasNodeData } from "@/lib/canvas/canvas-graph";
import {
  buildCanvasRunPlan,
  type CanvasRunMode,
} from "@/lib/canvas/canvas-run-plan";
import type { CanvasFlowNode } from "@/lib/canvas/canvas-store";
import type { CanvasGraph } from "@/lib/canvas/canvas-graph";
import type { PortalPublicModel } from "@/types/admin";
import { messages } from "@/messages";

import {
  buildRunPlanRows,
  estimateRunCost,
  orderRunPlanNodes,
  summarizeRunPlan,
  type RunConfirmState,
} from "../lib/run-plan-view";

/**
 * Run state and planning: menu, confirmation draft, active run handles and the
 * view models the dialog needs. Execution lives with the editor for now (it
 * needs the node runner), so the setters are returned too.
 */
export function useCanvasRun(input: {
  canvasId: string;
  nodes: CanvasFlowNode[];
  models: PortalPublicModel[];
  toGraph: () => CanvasGraph;
  selectedRunNodeIds: string[];
  openModelSettings: () => void;
  isGenerationConfigured: () => boolean;
  // State stays with the editor so hook ordering stays trivial.
  runMenuOpen: boolean;
  setRunMenuOpen: (value: boolean) => void;
  runListExpanded: boolean;
  setRunListExpanded: Dispatch<SetStateAction<boolean>>;
  runConfirm: RunConfirmState | null;
  setRunConfirm: Dispatch<SetStateAction<RunConfirmState | null>>;
  activeRun: { mode: CanvasRunMode; controller: AbortController } | null;
  agentRunId: string | null;
  serverRunId: string | null;
  setServerRunId: (value: string | null) => void;
  setActiveRun: (value: {
    mode: CanvasRunMode;
    controller: AbortController;
  } | null) => void;
  setAgentRunId: (value: string | null) => void;
  updateNodeData: (nodeId: string, patch: Partial<CanvasNodeData>) => void;
  syncFromServer: () => Promise<void>;
  activeRunsRef: MutableRefObject<Map<string, AbortController>>;
  agentRunSeenRef: MutableRefObject<boolean>;
}) {
  const {
    canvasId,
    nodes,
    models,
    toGraph,
    selectedRunNodeIds,
    openModelSettings,
    isGenerationConfigured,
    setRunMenuOpen,
    runListExpanded,
    setRunListExpanded,
    runConfirm,
    setRunConfirm,
    activeRun,
    agentRunId,
    serverRunId,
    setServerRunId,
    setActiveRun,
    setAgentRunId,
    updateNodeData,
    syncFromServer,
    activeRunsRef,
    agentRunSeenRef,
  } = input;

  const cancelNodeRun = useCallback(
    (nodeId: string) => {
      const controller = activeRunsRef.current.get(nodeId);
      if (controller) {
        controller.abort();
      }
    },
    [activeRunsRef],
  );

  /** Build the plan for a mode and open the confirmation dialog. */
  const prepareRun = useCallback(
    (mode: CanvasRunMode, nodeIds?: string[]) => {
      setRunMenuOpen(false);
      if (activeRun || activeRunsRef.current.size > 0) {
        toast.info(messages.canvas.runAlreadyRunning);
        return;
      }
      if (!isGenerationConfigured()) {
        toast.danger(messages.canvas.generationMissing);
        openModelSettings();
        return;
      }
      const selectedIds = nodeIds ?? selectedRunNodeIds;
      if (
        (mode === "selected" || mode === "node" || mode === "from") &&
        selectedIds.length === 0
      ) {
        toast.info(messages.canvas.runSelectNode);
        return;
      }
      const plan = buildCanvasRunPlan(toGraph(), {
        mode,
        selectedNodeIds: selectedIds,
        fromNodeIds: selectedIds,
      });
      if (!plan) {
        toast.info(
          mode === "retry-failed"
            ? messages.canvas.runNoFailed
            : mode === "all"
              ? messages.canvas.runNoNodes
              : messages.canvas.runSelectNode,
        );
        return;
      }
      setRunListExpanded(false);
      setRunConfirm({
        mode,
        plan,
        selectedNodeIds: selectedIds,
        includeUpstream: mode !== "node",
      });
    },
    [
      activeRun,
      activeRunsRef,
      isGenerationConfigured,
      openModelSettings,
      selectedRunNodeIds,
      setRunConfirm,
      setRunListExpanded,
      setRunMenuOpen,
      toGraph,
    ],
  );

  /** Flip between "selected + upstream" and "selected only" inside the dialog. */
  const setRunIncludeUpstream = useCallback(
    (includeUpstream: boolean) => {
      setRunConfirm((current) => {
        if (!current) {
          return current;
        }
        const mode: CanvasRunMode = includeUpstream ? "selected" : "node";
        const plan =
          buildCanvasRunPlan(toGraph(), {
            mode,
            selectedNodeIds: current.selectedNodeIds,
          }) ?? current.plan;
        return { ...current, mode, plan, includeUpstream };
      });
    },
    [setRunConfirm, toGraph],
  );

  const prepareRunSelected = useCallback(
    (nodeIds: string[]) => {
      prepareRun("selected", nodeIds);
    },
    [prepareRun],
  );

  const cancelActiveRun = useCallback(() => {
    setRunMenuOpen(false);
    if (agentRunId) {
      void cancelAgentRun(canvasId, agentRunId)
        .then(() => {
          setAgentRunId(null);
          agentRunSeenRef.current = false;
        })
        .catch((error) => {
          toast.danger(
            error instanceof Error ? error.message : messages.canvas.runFailed,
          );
        });
    }
    if (serverRunId) {
      void cancelCanvasRun(canvasId, serverRunId).catch((error) => {
        toast.danger(
          error instanceof Error ? error.message : messages.canvas.runFailed,
        );
      });
      return;
    }
    activeRun?.controller.abort();
  }, [
    activeRun,
    agentRunId,
    agentRunSeenRef,
    canvasId,
    serverRunId,
    setAgentRunId,
    setRunMenuOpen,
  ]);

  useEffect(() => {
    return () => {
      activeRun?.controller.abort();
    };
  }, [activeRun]);

  const executeNode = useCallback(
    async (nodeId: string, signal?: AbortSignal) => {
      // Read from the store instead of closing over `nodes`: a dependency on
      // the node array made this callback (and the actions context built from
      // it) new on every drag frame, so every node component re-rendered.
      const node = useCanvasStore.getState().nodes.find((item) => item.id === nodeId);
      if (!node) {
        throw new Error(messages.canvas.nodeMissing);
      }
      if (!isGenerationConfigured()) {
        throw new Error(messages.canvas.generationMissing);
      }
      if (
        node.type !== "image" &&
        node.type !== "video" &&
        node.type !== "text"
      ) {
        throw new Error(messages.canvas.runUnsupported);
      }
      const run =
        node.type === "image"
          ? runCanvasImageNode
          : node.type === "video"
            ? runCanvasVideoNode
            : runCanvasTextNode;
      await run({
        nodeId,
        graph: toGraph(),
        apiKey: "",
        update: updateNodeData,
        signal,
      });
    },
    [isGenerationConfigured, toGraph, updateNodeData],
  );

  const runNode = useCallback(
    async (nodeId: string) => {
      if (activeRun) {
        toast.info(messages.canvas.runAlreadyRunning);
        return;
      }
      const current = useCanvasStore
        .getState()
        .nodes.find((node) => node.id === nodeId);
      if (
        activeRunsRef.current.has(nodeId) ||
        current?.data.status === "running" ||
        current?.data.status === "queued"
      ) {
        toast.info(messages.canvas.runAlreadyRunning);
        return;
      }
      const controller = new AbortController();
      activeRunsRef.current.set(nodeId, controller);
      const startedAt = new Date().toISOString();
      let failure: string | null = null;
      try {
        await executeNode(nodeId, controller.signal);
      } catch (error) {
        failure =
          error instanceof Error ? error.message : messages.canvas.runFailed;
        toast.danger(failure);
      } finally {
        activeRunsRef.current.delete(nodeId);
        // Single-node runs are editor-side too; record them so the run history
        // reflects every way a node can be executed.
        const node = useCanvasStore
          .getState()
          .nodes.find((item) => item.id === nodeId);
        void recordCanvasRun(canvasId, {
          mode: "node",
          status: failure ? "failed" : node?.data.status === "failed" ? "failed" : "succeeded",
          nodeIds: [nodeId],
          nodeStates: {
            [nodeId]: {
              status: node?.data.status ?? (failure ? "failed" : "succeeded"),
              ...(node?.data.error ? { error: node.data.error } : {}),
            },
          },
          startedAt,
          finishedAt: new Date().toISOString(),
        }).catch(() => undefined);
      }
    },
    [activeRun, activeRunsRef, canvasId, executeNode],
  );

  const startLocalPlanRun = useCallback(async () => {
    const pending = runConfirm;
    if (!pending) {
      return;
    }
    setRunConfirm(null);
    const controller = new AbortController();
    setActiveRun({ mode: pending.mode, controller });
    const planned = new Set(pending.plan.nodeIds);
    useCanvasStore.setState((state) => ({
      nodes: state.nodes.map((node) =>
        planned.has(node.id)
          ? {
              ...node,
              data: {
                ...node.data,
                status: "queued",
                error: undefined,
                finishedAt: undefined,
              },
            }
          : node,
      ),
    }));
    const startedAt = new Date().toISOString();
    try {
      const result = await runCanvasPlan({
        plan: pending.plan,
        signal: controller.signal,
        concurrency: 2,
        // The runner updates node data directly; the snapshot merge keeps those
        // live fields alive across agent writes, so no separate mirror is needed
        // (and mirroring only the plan-level "queued" made the overlay stick).
        update: updateNodeData,
        runNode: (nodeId, signal) => executeNode(nodeId, signal),
      });
      // Editor runs execute in the browser, so the server only learns about
      // them from this call — it is what puts them in the run history.
      const finalNodes = useCanvasStore.getState().nodes;
      const nodeStates: Record<string, { status: string; error?: string | null }> = {};
      for (const nodeId of pending.plan.nodeIds) {
        const node = finalNodes.find((item) => item.id === nodeId);
        nodeStates[nodeId] = {
          status: node?.data.status ?? "skipped",
          ...(node?.data.error ? { error: node.data.error } : {}),
        };
      }
      const status =
        controller.signal.aborted
          ? "cancelled"
          : result.failed.length > 0 && result.failed.length >= pending.plan.nodeIds.length
            ? "failed"
            : result.failed.length > 0 || result.skipped.length > 0
              ? "partial"
              : "succeeded";
      void recordCanvasRun(canvasId, {
        mode: pending.mode,
        status,
        nodeIds: pending.plan.nodeIds,
        nodeStates,
        startedAt,
        finishedAt: new Date().toISOString(),
      }).catch(() => undefined);

      if (controller.signal.aborted) {
        toast.info(messages.canvas.runCancelled);
      } else if (result.failed.length > 0 || result.skipped.length > 0) {
        toast.info(
          messages.canvas.runPartial
            .replace("{failed}", String(result.failed.length))
            .replace("{skipped}", String(result.skipped.length)),
        );
      } else {
        toast.success(messages.canvas.runCompleted);
      }
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : messages.canvas.runFailed,
      );
    } finally {
      setActiveRun(null);
    }
  }, [
    canvasId,
    executeNode,
    runConfirm,
    setActiveRun,
    setRunConfirm,
    updateNodeData,
  ]);

  const startPlanRun = useCallback(async () => {
    await startLocalPlanRun();
  }, [startLocalPlanRun]);

  useEffect(() => {
    let stopped = false;
    void getActiveCanvasRun(canvasId)
      .then((run) => {
        if (!stopped && run) {
          setServerRunId(run.id);
        }
      })
      .catch(() => undefined);
    return () => {
      stopped = true;
    };
  }, [canvasId, setServerRunId]);

  useEffect(() => {
    if (!serverRunId) {
      return;
    }
    let stopped = false;
    let timer: number | null = null;
    async function poll() {
      try {
        const run = await getCanvasRun(canvasId, serverRunId!);
        if (stopped) {
          return;
        }
        const runStatus = useCanvasRunStatusStore.getState();
        for (const item of run.nodes) {
          runStatus.setNode(
            item.nodeId,
            item.status === "pending" ? "queued" : item.status,
            item.error ?? undefined,
            item.requestId ?? undefined,
            item.taskId ?? undefined,
          );
        }
        if (["succeeded", "partial", "failed", "cancelled"].includes(run.status)) {
          stopped = true;
          setServerRunId(null);
          setActiveRun(null);
          useCanvasRunStatusStore.getState().reset();
          if (run.status === "cancelled") {
            toast.info(messages.canvas.runCancelled);
          } else if (run.status === "succeeded") {
            toast.success(messages.canvas.runCompleted);
          } else {
            toast.info(run.error ?? messages.canvas.runFailed);
          }
          await syncFromServer();
          return;
        }
        timer = window.setTimeout(() => void poll(), 1500);
      } catch (error) {
        if (stopped) {
          return;
        }
        stopped = true;
        setServerRunId(null);
        setActiveRun(null);
        useCanvasRunStatusStore.getState().reset();
        toast.danger(
          error instanceof Error ? error.message : messages.canvas.runFailed,
        );
      }
    }
    void poll();
    return () => {
      stopped = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [canvasId, serverRunId, setActiveRun, setServerRunId, syncFromServer, updateNodeData]);

  useEffect(() => {
    let cancelled = false;

    function mapAgentNodeStatus(
      status: AgentRunNodeStateView["status"],
    ): CanvasNodeRunStatus {
      if (status === "pending") {
        return "queued";
      }
      return status;
    }

    const tick = async () => {
      try {
        const { run } = await getActiveAgentRun(canvasId);
        if (cancelled) {
          return;
        }
        if (!run) {
          if (agentRunSeenRef.current) {
            agentRunSeenRef.current = false;
            setAgentRunId(null);
            // Drop the overlay entries: the run is over and the transcript of
            // node states is stale from here on.
            useCanvasRunStatusStore.getState().reset();
            void syncFromServer();
          }
          return;
        }
        agentRunSeenRef.current = true;
        setAgentRunId(run.runId);
        const statusStore = useCanvasRunStatusStore.getState();
        for (const nodeId of run.nodeIds) {
          const state = run.nodes[nodeId];
          if (!state) {
            statusStore.setNode(nodeId, "queued");
            updateNodeData(nodeId, { status: "queued", error: undefined });
            continue;
          }
          const mapped = mapAgentNodeStatus(state.status);
          statusStore.setNode(
            nodeId,
            mapped,
            state.error,
            state.requestId,
            run.runId,
          );
          updateNodeData(nodeId, {
            status: mapped,
            ...(state.error !== undefined ? { error: state.error } : {}),
            ...(state.requestId ? { requestId: state.requestId } : {}),
            ...(state.outputUrl
              ? {
                  url: state.outputUrl,
                  urls: [state.outputUrl],
                  source: "generation" as const,
                }
              : {}),
            ...(mapped === "running" || mapped === "queued"
              ? { finishedAt: undefined }
              : {}),
          });
        }
      } catch {
        // Ignore transient poll failures.
      }
    };

    const timer = window.setInterval(() => {
      void tick();
    }, 2000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [agentRunSeenRef, canvasId, setAgentRunId, syncFromServer, updateNodeData]);

  // ---- view models for the dialog -------------------------------------------
  const runSummary = useMemo(
    () => (runConfirm ? summarizeRunPlan(runConfirm, nodes) : null),
    [nodes, runConfirm],
  );
  const runDisplayOrder = useMemo(
    () => (runConfirm ? orderRunPlanNodes(runConfirm, nodes) : []),
    [nodes, runConfirm],
  );
  const runRows = useMemo(() => {
    if (!runConfirm) {
      return [];
    }
    return buildRunPlanRows({
      runConfirm,
      nodes,
      order: runDisplayOrder,
      limit: runListExpanded ? runDisplayOrder.length : 8,
    });
  }, [nodes, runConfirm, runDisplayOrder, runListExpanded]);
  const runCostEstimate = useMemo(
    () => (runConfirm ? estimateRunCost({ runConfirm, nodes, models }) : null),
    [models, nodes, runConfirm],
  );
  const runHasUpstream = useMemo(() => {
    if (
      !runConfirm ||
      (runConfirm.mode !== "selected" && runConfirm.mode !== "node")
    ) {
      return false;
    }
    const graph = toGraph();
    const withUpstream = buildCanvasRunPlan(graph, {
      mode: "selected",
      selectedNodeIds: runConfirm.selectedNodeIds,
    });
    const without = buildCanvasRunPlan(graph, {
      mode: "node",
      selectedNodeIds: runConfirm.selectedNodeIds,
    });
    return (
      (withUpstream?.nodeIds.length ?? 0) > (without?.nodeIds.length ?? 0)
    );
  }, [runConfirm, toGraph]);

  return {
    executeNode,
    runNode,
    startLocalPlanRun,
    startPlanRun,
    cancelNodeRun,
    prepareRun,
    prepareRunSelected,
    setRunIncludeUpstream,
    cancelActiveRun,
    runSummary,
    runDisplayOrder,
    runRows,
    runCostEstimate,
    runHasUpstream,
  };
}
