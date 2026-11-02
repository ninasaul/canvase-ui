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
import { cancelAgentRun, cancelCanvasRun } from "@/lib/canvas/canvas-api";
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
  activeRunRef: MutableRefObject<boolean>;
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
    setAgentRunId,
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
