"use client";

import "@xyflow/react/dist/style.css";

import {
  ArrowLeft,
  Brain,
  ChatCircle,
  CircleNotch,
  Clock,
  DownloadSimple,
  FolderPlus,
  ImageSquare,
  Keyboard,
  Play,
  Plugs,
  StopCircle,
  TextT,
  VideoCamera,
  Waveform,
} from "@phosphor-icons/react";
import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { CanvasActionsContext } from "@/components/canvas/canvas-actions";
import {
  CanvasRunningTasksModal,
  type CanvasTasksTab,
} from "@/components/canvas/canvas-running-tasks";
import { CanvasShortcutsModal } from "@/components/canvas/canvas-shortcuts-modal";
import {
  type CanvasRunMode,
} from "@/lib/canvas/canvas-dag-runner";
import { CanvasPreferencesProvider } from "@/components/canvas/canvas-preferences-context";
import { PlaygroundMediaLibraryPicker } from "@/components/playground/playground-media-library-picker";
import { uploadPlaygroundAssetWithMeta } from "@/lib/playground-media";
import { CanvasHelperLinesOverlay } from "@/components/canvas/canvas-helper-lines";
import {
  CanvasAgentChatPanel,
  loadCanvasAgentChatOpenPreference,
} from "@/components/canvas/canvas-agent-chat-panel";
import { CanvasGenerationDock } from "@/components/canvas/editor/chrome/canvas-generation-dock";
import { CanvasNodeDockSlot } from "@/components/canvas/editor/chrome/canvas-node-dock-slot";
import { CanvasOverlays } from "@/components/canvas/editor/chrome/canvas-overlays";
import { CanvasPanningFlag } from "@/components/canvas/editor/chrome/canvas-panning-flag";
import { CanvasSelectionBar } from "@/components/canvas/editor/chrome/canvas-selection-bar";
import { CanvasBackdrop } from "@/components/canvas/editor/chrome/canvas-backdrop";
import { CanvasBottomDock } from "@/components/canvas/editor/chrome/canvas-bottom-dock";
import { CanvasConflictBanner } from "@/components/canvas/editor/chrome/canvas-conflict-banner";
import { CanvasToolbar } from "@/components/canvas/editor/chrome/canvas-toolbar";
import { CanvasFlowSurface } from "@/components/canvas/editor/workspace/canvas-flow-surface";
import {
  connectionFromConnectDrop,
  type CanvasConnectDropFrom,
} from "@/lib/canvas/canvas-connect-drop";
import { CanvasRunConfirmModal } from "@/components/canvas/editor/panels/canvas-run-confirm-modal";
import {
  EMPTY_NODES as EMPTY_GRAPH_NODES,
  getCanvasMediaUrls,
} from "@/lib/canvas/canvas-derived";
import {
  useCanvasMediaCounts,
  useGroupableSelectionCount,
  useSelectedIdKey,
} from "@/lib/canvas/canvas-selectors";
import { getNodeById } from "@/lib/canvas/canvas-node-index";
import { useCanvasViewportPerfStore } from "@/lib/canvas/canvas-viewport-perf-store";
import { useShallow } from "zustand/react/shallow";

/** Stable identity for "no visible nodes" while the chat panel is closed. */
const EMPTY_VISIBLE_IDS: string[] = [];


import { LocaleToggle } from "@/components/locale-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Loading } from "@/components/ui/loading";
import { Tooltip } from "@/components/ui/tooltip";
import { Popover } from "@/components/ui/popover";
import { toast } from "@/components/ui/toast";
import { useTheme } from "@/components/theme-provider";
import { useCurrencySymbol } from "@/components/currency-provider";
import { usePortalQuery } from "@/hooks/use-portal-query";
import {
  getCanvas,
  listAgentTokens,
  uploadCanvasThumbnail,
  type CanvasDetail,
} from "@/lib/canvas/canvas-api";
import {
  applyTransientNodeState,
  captureTransientNodeState,
} from "@/lib/canvas/canvas-transient-state";
import { mergeRemoteSnapshot } from "@/lib/canvas/canvas-snapshot-merge";
import type { CanvasGraph } from "@/lib/canvas/canvas-graph";
import {
  loadCanvasPreferences,
  saveCanvasPreferences,
  type CanvasPreferences,
} from "@/lib/canvas/canvas-preferences";
import { stableGraphJson } from "@/lib/canvas/canvas-graph-json";
import { downloadCanvasArchive } from "@/lib/canvas/canvas-archive";
import {
  canvasLayoutPositionsEqual,
  layoutCanvasNodes,
  type CanvasAutoLayoutMode,
} from "@/lib/canvas/canvas-auto-layout";
import {
} from "@/lib/canvas/canvas-runner";
import { useCanvasStore } from "@/lib/canvas/canvas-store";
import { recoverCanvasNode } from "@/lib/canvas/canvas-task-recovery";
import { useCanvasDocument } from "@/components/canvas/editor/workspace/use-canvas-document";
import { useCanvasRun } from "@/components/canvas/editor/workspace/use-canvas-run";
import { useCanvasShortcuts } from "@/components/canvas/editor/workspace/use-canvas-shortcuts";
import { useCanvasViewport } from "@/components/canvas/editor/workspace/use-canvas-viewport";
import { useCanvasSettings } from "@/components/canvas/editor/workspace/use-canvas-settings";
import { useCanvasHistory } from "@/lib/canvas/use-canvas-history";
import { useCanvasRunStatusStore } from "@/lib/canvas/canvas-run-status-store";
import { formatDateTime } from "@/lib/format";
import { useLocaleRouter } from "@/lib/locale-navigation";
import { messages } from "@/messages";
import { loadGenerationModels } from "@/lib/generation/local-models";
import {
  isGenerationConfigured,
  readByokBaseUrl,
  readByokConfig,
} from "@/lib/generation/byok-store";

import { pruneCanvasSettingsModels } from "@/lib/canvas/canvas-settings-prune";




import { CANVAS_BACKGROUND_PATTERN_COLORS } from "@/components/canvas/editor/lib/constants";
import type { RunConfirmState } from "@/components/canvas/editor/lib/run-plan-view";
import { nodeTypeLabel } from "@/components/canvas/editor/lib/node-display";


function CanvasEditorInner({
  canvasDocument,
}: {
  canvasDocument: CanvasDetail;
}) {
  const { push } = useLocaleRouter();
  const { resolvedTheme } = useTheme();
  const currencySymbol = useCurrencySymbol();
  const { screenToFlowPosition, fitView, zoomTo, zoomIn, zoomOut, setCenter } =
    useReactFlow();
  const canvasSurfaceRef = useRef<HTMLDivElement>(null);
  const [configNodeId, setConfigNodeId] = useState<string | null>(null);

  useState(() => {
    useCanvasStore.getState().reset(canvasDocument.graph);
  });
  const [title, setTitle] = useState(canvasDocument.title);
  const [thumbnailUrl, setThumbnailUrl] = useState(
    canvasDocument.thumbnailUrl ?? null,
  );
  const [thumbnailBusy, setThumbnailBusy] = useState(false);
  const thumbnailRef = useRef<HTMLInputElement>(null);
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false);
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
  const [connectAgentOpen, setConnectAgentOpen] = useState(false);
  const [agentChatOpen, setAgentChatOpen] = useState(() =>
    loadCanvasAgentChatOpenPreference(),
  );
  const [agentTokenActive, setAgentTokenActive] = useState(false);
  const [runMenuOpen, setRunMenuOpen] = useState(false);
  const [runListExpanded, setRunListExpanded] = useState(false);
  const [runConfirm, setRunConfirm] = useState<RunConfirmState | null>(null);
  const [activeRun, setActiveRun] = useState<{
    mode: CanvasRunMode;
    controller: AbortController;
  } | null>(null);
  const [serverRunId, setServerRunId] = useState<string | null>(null);
  const [agentRunId, setAgentRunId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<CanvasPreferences>(() =>
    loadCanvasPreferences(),
  );
  const [byokRevision, setByokRevision] = useState(0);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [nodeInfoOpen, setNodeInfoOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [tasksTab, setTasksTab] = useState<CanvasTasksTab>("running");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(canvasDocument.title);
  const [selectMode, setSelectMode] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const runMenuButtonRef = useRef<HTMLButtonElement>(null);
  const [archiveMenuOpen, setArchiveMenuOpen] = useState(false);
  const [insertMenu, setInsertMenu] = useState<{
    left: number;
    top: number;
    flow: { x: number; y: number };
    /** Set when the menu was opened by a handle drag that missed a target. */
    connectFrom?: CanvasConnectDropFrom;
  } | null>(null);
  const [archiveBusy, setArchiveBusy] = useState<"image" | "video" | null>(null);
  const archiveButtonRef = useRef<HTMLButtonElement>(null);
  const toolbarUploadRef = useRef<HTMLInputElement>(null);
  const [toolbarUploading, setToolbarUploading] = useState(false);
  const [toolbarUploadProgress, setToolbarUploadProgress] = useState(0);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const layoutMenuButtonRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef(canvasDocument.title);
  const activeRunRef = useRef(false);
  const activeRunsRef = useRef<Map<string, AbortController>>(new Map());
  const agentRunSeenRef = useRef(false);
  const rebaseAttemptsRef = useRef(0);

  /**
   * The editor deliberately does *not* subscribe to the node/edge arrays: they
   * are replaced on every drag frame, and holding them here re-rendered the
   * whole editor tree (chat panel, docks, modals, toolbar) once per mousemove.
   * Components that really need the array subscribe to it themselves
   * (`CanvasFlowSurface`, `CanvasNodeLabels`, the overlays); callbacks read it
   * on demand with `useCanvasStore.getState()`.
   *
   * What stays here are cheap, cached summaries: they re-render the editor only
   * when the selection actually changes.
   */
  const {
    zoomRef,
    syncViewport,
    viewportLocked,
    setViewportLocked,
  } = useCanvasViewport();

  // Only the *number* of groupable nodes matters here (toolbar/shortcuts).
  // Subscribing to the objects re-rendered the editor on every keystroke in a
  // selected node, because editing replaces that node object.
  const groupableSelectionCount = useGroupableSelectionCount();
  /**
   * Run planning needs every selected node, including group containers (their
   * children get expanded) and nodes nested inside a group.
   */
  // Viewport changes every frame while panning; keep only what we need as
  // state, refreshed when the gesture ends (a re-render per frame is costly).

  const selectedIdsKey = useSelectedIdKey();

  // Derived from `selectedIdsKey`  so this stays referentially
  // stable while the selection is unchanged: a drag frame replaces `nodes`,
  // and a new array here produced a new `prepareRunSelected`, a new `actions`
  // context value, and a re-render of every node that consumes it.
  const selectedRunNodeIds = useMemo(
    () => (selectedIdsKey ? selectedIdsKey.split(",") : []),
    [selectedIdsKey],
  );
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(
    null,
  );
  const highlightTimerRef = useRef<number | null>(null);
  /** Flash the node the agent is touching, and pan to it when off-screen. */
  const highlightAgentNode = useCallback(
    (nodeId: string) => {
      const store = useCanvasStore.getState();
      const node = store.nodes.find((item) => item.id === nodeId);
      if (!node) {
        return;
      }
      setHighlightedNodeId(nodeId);
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightedNodeId(null);
        highlightTimerRef.current = null;
      }, 2600);
      const parent = node.parentId
        ? store.nodes.find((item) => item.id === node.parentId)
        : undefined;
      const x = node.position.x + (parent?.position.x ?? 0);
      const y = node.position.y + (parent?.position.y ?? 0);
      const width = node.width ?? 240;
      const height = node.height ?? 240;
      if (!useCanvasViewportPerfStore.getState().visibleNodeIds.has(nodeId)) {
        setCenter(x + width / 2, y + height / 2, {
          zoom: zoomRef.current || 1,
          duration: 450,
        });
      }
    },
    [setCenter, zoomRef],
  );

  // Keyed on the selected ids, not on the node array: a drag frame replaces
  // `nodes`, and rebuilding this array handed the chat panel a new prop every
  // frame (it re-rendered even though nothing about the selection changed).
  const selectionChips = useMemo(() => {
    if (!selectedIdsKey) {
      return [];
    }
    const byId = new Map(
      useCanvasStore.getState().nodes.map((node) => [node.id, node]),
    );
    return selectedIdsKey
      .split(",")
      .slice(0, 6)
      .flatMap((id) => {
        const node = byId.get(id);
        return node
          ? [
              {
                id,
                label: node.data.label?.trim() || nodeTypeLabel(node.type),
              },
            ]
          : [];
      });
  }, [selectedIdsKey]);
  const removeSelection = useCallback((nodeId: string) => {
    useCanvasStore.setState((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId && node.selected
          ? { ...node, selected: false }
          : node,
      ),
    }));
  }, []);

  const settings = useCanvasStore((state) => state.settings);
  const setSettings = useCanvasStore((state) => state.setSettings);
  const canvasSettings = useCanvasSettings({
    settings,
    preferences,
    setSettings,
    setPreferences,
  });
  const {
    settingsDraft,
    setSettingsDraft,
    storageConfigured,
    openCanvasSettings,
  } = canvasSettings;
  const addNode = useCanvasStore((state) => state.addNode);
  const selectAll = useCanvasStore((state) => state.selectAll);
  const clearSelection = useCanvasStore((state) => state.clearSelection);
  const addMediaNode = useCanvasStore((state) => state.addMediaNode);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const duplicateNode = useCanvasStore((state) => state.duplicateNode);
  const replace = useCanvasStore((state) => state.replace);
  const toGraph = useCanvasStore((state) => state.toGraph);




  const history = useCanvasHistory();

  const modelsQuery = usePortalQuery(
    `generation-canvas-models:${readByokBaseUrl()}:${byokRevision}`,
    () => loadGenerationModels(),
  );
  const models = useMemo(() => modelsQuery.data ?? [], [modelsQuery.data]);

  const openModelSettings = useCallback(() => {
    setModelSettingsOpen(true);
  }, []);

  useEffect(() => {
    useCanvasRunStatusStore.getState().reset();
    setAgentRunId(null);
    agentRunSeenRef.current = false;
  }, [canvasDocument.id]);

  useEffect(() => {
    let cancelled = false;
    void listAgentTokens(canvasDocument.id)
      .then((result) => {
        if (!cancelled) {
          setAgentTokenActive(result.items.some((item) => item.active));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAgentTokenActive(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canvasDocument.id]);

  /**
   * Adopt a server snapshot in place (after an AI agent or another tab wrote).
   * Doing this instead of a full reload keeps undo history, viewport and selection.
   */
  const syncFromServerRef = useRef<() => Promise<void>>(async () => undefined);

  // Nodes are only needed by the run-confirm dialog. While it is closed the
  // selector returns a stable empty array, so drag frames never reach the
  // editor.
  const runPlanNodes = useCanvasStore(
    useShallow((state) => (runConfirm ? state.nodes : EMPTY_GRAPH_NODES)),
  );

  const {
    runNode,
    startPlanRun,
    cancelNodeRun,
    prepareRun,
    prepareRunSelected,
    setRunIncludeUpstream,
    cancelActiveRun,
    runSummary,
    runRows,
    runCostEstimate,
    runHasUpstream,
  } = useCanvasRun({
    canvasId: canvasDocument.id,
    // Only the run-confirm dialog needs the node array. Gating the
    // subscription on it keeps drag frames out of the editor render.
    nodes: runPlanNodes,
    models,
    toGraph,
    selectedRunNodeIds,
    openModelSettings,
    isGenerationConfigured,
    runMenuOpen,
    setRunMenuOpen,
    runListExpanded,
    setRunListExpanded,
    runConfirm,
    setRunConfirm,
    activeRun,
    serverRunId,
    setServerRunId,
    setActiveRun,
    agentRunId,
    setAgentRunId,
    updateNodeData,
    syncFromServer: () => syncFromServerRef.current(),
    activeRunsRef,
    agentRunSeenRef,
  });

  const tryRebaseRef = useRef<() => Promise<boolean>>(async () => false);
  const {
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
    version,
    lastSavedRef,
    graphObservationRef,
    markDirty,
    flushSaveRef,
  } = useCanvasDocument({
    canvasId: canvasDocument.id,
    initial: {
      version: canvasDocument.version,
      title: canvasDocument.title,
      updatedAt: canvasDocument.updatedAt,
    },
    toGraph,
    titleRef,
    tryRebase: () => tryRebaseRef.current(),
    settings,
    title,
    runActive: Boolean(activeRun),
    serverRunId,
  });

  const applyRemoteSnapshot = useCallback(
    (remote: CanvasDetail) => {
      const store = useCanvasStore.getState();
      // A local run lives only in memory until it finishes; keep those nodes
      // looking busy instead of snapping back to idle after an agent write.
      const liveNodes = captureTransientNodeState(store.nodes);

      // Three-way merge: keep whatever the user changed locally (unsaved drags,
      // edits made while the agent was working) instead of reverting it, and
      // keep the current selection unless the agent explicitly changed it.
      let base: CanvasGraph = remote.graph;
      try {
        base = JSON.parse(lastSavedRef.current.graph) as CanvasGraph;
      } catch {
        base = remote.graph;
      }
      const merged = mergeRemoteSnapshot({
        base,
        local: store.toGraph(),
        remote: remote.graph,
      });
      store.reset(merged.graph);
      if (liveNodes.size > 0) {
        useCanvasStore.setState((state) => ({
          nodes: applyTransientNodeState(state.nodes, liveNodes),
        }));
      }
      const next = useCanvasStore.getState();
      graphObservationRef.current = {
        nodes: next.nodes,
        edges: next.edges,
        settings: next.settings,
        title: remote.title,
      };
      lastSavedRef.current = {
        title: remote.title,
        graph: stableGraphJson(remote.graph),
      };
      versionRef.current = remote.version;
      setVersion(remote.version);
      setTitle(remote.title);
      titleRef.current = remote.title;
      setTitleDraft(remote.title);
      setSavedAt(remote.updatedAt);
      conflictRef.current = false;
      setConflict(false);
      rebaseAttemptsRef.current = 0;
      markDirty(merged.keptLocal > 0);
      if (merged.keptLocal > 0 && !activeRunRef.current) {
        // Re-apply the kept local edits on top of the new server version.
        window.setTimeout(() => {
          void flushSaveRef.current();
        }, 0);
      }
    },
    [
      conflictRef,
      flushSaveRef,
      graphObservationRef,
      lastSavedRef,
      markDirty,
      setConflict,
      setSavedAt,
      setVersion,
      versionRef,
    ],
  );

  /**
   * Pull the latest server graph without remounting the editor. A remount
   * (`query.reload()` + `key={id:version}`) resets the agent chat panel and its
   * selected model, so background syncs go through here instead.
   */
  const syncFromServer = useCallback(async () => {
    try {
      if (dirtyRef.current && !activeRunRef.current) {
        await flushSaveRef.current();
      }
      if (dirtyRef.current || conflictRef.current) {
        return;
      }
      const remote = await getCanvas(canvasDocument.id);
      if (remote.version >= versionRef.current) {
        applyRemoteSnapshot(remote);
      }
    } catch {
      // Background sync is best-effort.
    }
  }, [applyRemoteSnapshot, canvasDocument.id, conflictRef, dirtyRef, flushSaveRef, versionRef]);

  /** Manual refresh (Shift+R): pull the server graph without remounting. */
  useEffect(() => {
    syncFromServerRef.current = syncFromServer;
  }, [syncFromServer]);

  const refreshCanvas = useCallback(() => {
    void (async () => {
      try {
        // Mid-run the graph holds live "running" flags that the server does
        // not know about; saving them would leave stale status behind.
        if (dirtyRef.current && !activeRunRef.current) {
          await flushSaveRef.current();
        }
        if (conflictRef.current) {
          toast.info(messages.canvas.versionConflictBody);
          return;
        }
        const remote = await getCanvas(canvasDocument.id);
        if (remote.version > versionRef.current) {
          applyRemoteSnapshot(remote);
          toast.success(messages.canvas.canvasRefreshed);
        } else {
          toast.info(messages.canvas.canvasAlreadyLatest);
        }
      } catch (error) {
        toast.danger(
          error instanceof Error ? error.message : messages.canvas.saveFailed,
        );
      }
    })();
  }, [applyRemoteSnapshot, canvasDocument.id, conflictRef, dirtyRef, flushSaveRef, versionRef]);

  const agentChatSyncTimerRef = useRef<number | null>(null);
  const handleAgentChatGraphMutated = useCallback(() => {
    if (agentChatSyncTimerRef.current !== null) {
      window.clearTimeout(agentChatSyncTimerRef.current);
    }
    agentChatSyncTimerRef.current = window.setTimeout(() => {
      agentChatSyncTimerRef.current = null;
      void (async () => {
        try {
          // Persist local edits first: the agent snapshot is taken from an
          // earlier version and would otherwise silently drop them.
          if (dirtyRef.current && !activeRunRef.current) {
            await flushSaveRef.current();
          }
          if (dirtyRef.current || conflictRef.current) {
            // Still unsaved (user kept editing): leave it to the 409 rebase
            // path, which either adopts silently or shows the conflict banner.
            return;
          }
          const remote = await getCanvas(canvasDocument.id);
          if (remote.version >= versionRef.current) {
            applyRemoteSnapshot(remote);
          }
        } catch {
          // Ignore transient sync failures during agent chat.
        }
      })();
    }, 250);
  }, [applyRemoteSnapshot, canvasDocument.id, conflictRef, dirtyRef, flushSaveRef, versionRef]);

  useEffect(() => {
    return () => {
      if (agentChatSyncTimerRef.current !== null) {
        window.clearTimeout(agentChatSyncTimerRef.current);
      }
    };
  }, []);

  /**
   * A 409 only means the version moved. When the server graph is still exactly
   * what we last saved, nothing diverged — adopt the new version and retry
   * instead of locking the editor behind a banner until a reload.
   */


  const tryRebase = useCallback(async (): Promise<boolean> => {
    if (rebaseAttemptsRef.current >= 2) {
      return false;
    }
    rebaseAttemptsRef.current += 1;
    try {
      const latest = await getCanvas(canvasDocument.id);
      if (
        stableGraphJson(latest.graph) === lastSavedRef.current.graph &&
        latest.title === lastSavedRef.current.title
      ) {
        versionRef.current = latest.version;
        setVersion(latest.version);
        setSavedAt(latest.updatedAt);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [canvasDocument.id, lastSavedRef, setSavedAt, setVersion, versionRef]);

  useEffect(() => {
    tryRebaseRef.current = tryRebase;
  }, [tryRebase]);

  /** Conflict resolution: keep local edits and win the last write. */
  const forceSaveMine = useCallback(() => {
    void (async () => {
      try {
        const latest = await getCanvas(canvasDocument.id);
        versionRef.current = latest.version;
        setVersion(latest.version);
      } catch (error) {
        toast.danger(
          error instanceof Error ? error.message : messages.canvas.saveFailed,
        );
        return;
      }
      rebaseAttemptsRef.current = 2;
      conflictRef.current = false;
      setConflict(false);
      markDirty(true);
      void flushSaveRef.current();
    })();
  }, [canvasDocument.id, conflictRef, flushSaveRef, markDirty, setConflict, setVersion, versionRef]);

  /** Conflict resolution: drop local edits and adopt the server graph in place. */
  const discardAndLoadRemote = useCallback(() => {
    void (async () => {
      try {
        const remote = await getCanvas(canvasDocument.id);
        // applyRemoteSnapshot clears dirty/conflict and adopts the new version,
        // so the editor (and the agent panel) is never remounted.
        applyRemoteSnapshot(remote);
        toast.info(messages.canvas.conflictLoadedRemote);
      } catch (error) {
        toast.danger(
          error instanceof Error ? error.message : messages.canvas.saveFailed,
        );
      }
    })();
  }, [applyRemoteSnapshot, canvasDocument.id]);



  // Fresh on every render: `versionRef` changes without a state update.
  // Stable identity: a fresh object here re-rendered the chat panel on every
  // canvas frame. `version` comes from state, and the server rebuilds its own
  // digest each turn, so a one-tick lag is harmless.
  // Only the open chat panel consumes the visible-node list, so the
  // subscription is gated on it: a pan/zoom that changes the visible set must
  // not re-render the editor while the panel is closed.
  const visibleNodeIds = useCanvasViewportPerfStore(
    useShallow((state) =>
      agentChatOpen
        ? Array.from(state.visibleNodeIds).slice(0, 40)
        : EMPTY_VISIBLE_IDS,
    ),
  );
  const agentChatContext = useMemo(
    () => ({
      version,
      ...(selectedRunNodeIds.length > 0
        ? { selection: selectedRunNodeIds }
        : {}),
      ...(configNodeId ? { focusNodeId: configNodeId } : {}),
      ...(visibleNodeIds.length > 0 ? { visibleNodeIds } : {}),
    }),
    [configNodeId, selectedRunNodeIds, version, visibleNodeIds],
  );

  useEffect(() => {
    activeRunRef.current = Boolean(activeRun || serverRunId || agentRunId);
  }, [activeRun, agentRunId, serverRunId]);

  useEffect(() => {
    if (!agentTokenActive) {
      return;
    }
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      try {
        const remote = await getCanvas(canvasDocument.id);
        if (cancelled || remote.version <= versionRef.current) {
          return;
        }
        if (conflictRef.current || inFlightRef.current) {
          return;
        }
        // Local edits or a run in progress: leave it to the save path, which
        // rebases on 409 only when the server graph did not diverge.
        if (dirtyRef.current || activeRunRef.current) {
          return;
        }
        applyRemoteSnapshot(remote);
        toast.info(messages.canvas.externalUpdateApplied);
      } catch {
        // Ignore transient poll failures.
      }
    };
    const timer = window.setInterval(() => {
      void tick();
    }, 5000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [agentTokenActive, applyRemoteSnapshot, canvasDocument.id, conflictRef, dirtyRef, inFlightRef, versionRef]);


  useEffect(() => {
    void readByokConfig()
      .then(() => {
        setByokRevision((current) => current + 1);
      })
      .catch(() => {
        // Keep local cache when offline / unauthorized.
      });
  }, []);


  const imageModels = useMemo(
    () => models.filter((model) => model.capability === "image"),
    [models],
  );
  const videoModels = useMemo(
    () => models.filter((model) => model.capability === "video"),
    [models],
  );
  const chatModels = useMemo(
    () => models.filter((model) => model.capability === "chat"),
    [models],
  );

  useEffect(() => {
    if (!modelsQuery.data) {
      return;
    }
    const availableIds = new Set(models.map((model) => model.id));
    const pruned = pruneCanvasSettingsModels(settings, availableIds);
    if (pruned.changed) {
      setSettings(pruned.settings);
    }
    setSettingsDraft((current) => {
      const draftPruned = pruneCanvasSettingsModels(current, availableIds);
      return draftPruned.changed ? draftPruned.settings : current;
    });
  }, [models, modelsQuery.data, setSettings, setSettingsDraft, settings]);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  useEffect(() => {
    conflictRef.current = conflict;
  }, [conflict, conflictRef]);

  useEffect(() => {
    const controller = new AbortController();
    const current = useCanvasStore.getState().nodes;
    for (const node of current) {
      if (
        node.data.status !== "running" &&
        node.data.status !== "queued"
      ) {
        continue;
      }
      if (node.type === "text") {
        updateNodeData(node.id, {
          status: "interrupted",
          error: messages.canvas.taskRecoveryFailed,
        });
        continue;
      }
      if (node.type !== "image" && node.type !== "video") {
        continue;
      }
      const requestId = node.data.requestId?.trim();
      if (!requestId) {
        updateNodeData(node.id, {
          status: "interrupted",
          error: messages.canvas.taskRecoveryFailed,
        });
        continue;
      }
      void recoverCanvasNode({
        nodeId: node.id,
        requestId,
        mediaKind: node.type === "video" ? "video" : "image",
        fallbackUrl: node.data.url ?? "",
        update: updateNodeData,
        signal: controller.signal,
      });
    }
    return () => controller.abort();
  }, [updateNodeData]);

  useEffect(() => {
    saveCanvasPreferences(preferences);
  }, [preferences]);

  const handleDragStart = useCallback(() => {
    setInsertMenu(null);
  }, []);

  const addNodeWithPreset = useCallback(
    (
      type: "text" | "image" | "video" | "audio" | "group",
      position: { x: number; y: number },
    ) => {
      if (type === "group") {
        return addNode("group", position, {
          label: messages.canvas.groupDefault,
        });
      }
      const preset = settings[type];
      const data = preset
        ? {
            ...(preset.model ? { model: preset.model } : {}),
            ...(preset.vendor ? { vendor: preset.vendor } : {}),
            ...(preset.params ? { params: { ...preset.params } } : {}),
            ...(preset.systemPrompt
              ? { systemPrompt: preset.systemPrompt }
              : {}),
          }
        : undefined;
      return addNode(type, position, data);
    },
    [addNode, settings],
  );

  const addAtCenter = useCallback(
    (type: "text" | "image" | "video" | "audio") => {
      const offset = useCanvasStore.getState().nodes.length * 12;
      addNodeWithPreset(
        type,
        screenToFlowPosition({
          x: window.innerWidth / 2 + offset,
          y: window.innerHeight / 2 + offset,
        }),
      );
    },
    [addNodeWithPreset, screenToFlowPosition],
  );

  const addGroupAtCenter = useCallback(() => {
    addNodeWithPreset(
      "group",
      screenToFlowPosition({
        x: window.innerWidth / 2 - 210,
        y: window.innerHeight / 2 - 160,
      }),
    );
  }, [addNodeWithPreset, screenToFlowPosition]);

  useCanvasShortcuts({
    addAtCenter,
    addGroupAtCenter,
    flushSaveRef,
    clearSelection,
    configNodeId,
    duplicateNode,
    fitView,
    history,
    insertMenu,
    refreshCanvas,
    groupableSelectionCount,
    selectAll,
    selectMode,
    zoomTo,
    zoomIn,
    zoomOut,
    setAgentChatOpen,
    setConfigNodeId,
    setGroupName,
    setGroupOpen,
    setInsertMenu,
    setLayoutMenuOpen,
    setSelectMode,
    setSpacePressed,
    setViewportLocked,
  });



  const isBatchRunActive = Boolean(activeRun || serverRunId || agentRunId);

  const actions = useMemo(
    () => ({
      runNode: (nodeId: string) => void runNode(nodeId),
      cancelNodeRun,
      prepareRunSelected,
      cancelActiveRun,
      isBatchRunActive,
      models,
      canvasId: canvasDocument.id,
    }),
    [
      cancelActiveRun,
      cancelNodeRun,
      canvasDocument.id,
      isBatchRunActive,
      models,
      prepareRunSelected,
      runNode,
    ],
  );

  // Only the type is needed to pick a dock. Subscribing to the whole node
  // would re-render the editor on every keystroke in the dock, which is the
  // most common interaction in the app.
  const configNodeType = useCanvasStore((state) =>
    configNodeId ? getNodeById(state.nodes, configNodeId)?.type : undefined,
  );


  const mediaCounts = useCanvasMediaCounts();
  const downloadableImages = mediaCounts.images;
  const downloadableVideos = mediaCounts.videos;
  const autoLayoutModeLabel =
    preferences.autoLayoutMode === "layered-tb"
      ? messages.canvas.autoLayoutLayeredTb
      : preferences.autoLayoutMode === "grid"
        ? messages.canvas.autoLayoutGrid
        : messages.canvas.autoLayoutLayeredLr;

  const applyAutoLayout = useCallback(
    (mode: CanvasAutoLayoutMode) => {
      // Read the latest graph instead of closing over it: a dependency on the
      // node array made this callback new on every drag frame, which defeated
      // memo on the toolbar.
      const state = useCanvasStore.getState();
      const currentNodes = state.nodes;
      const currentEdges = state.edges;
      const next = layoutCanvasNodes(currentNodes, currentEdges, mode);
      if (
        next === currentNodes ||
        canvasLayoutPositionsEqual(currentNodes, next)
      ) {
        toast.info(messages.canvas.autoLayoutNoChange);
        return;
      }
      replace(next, currentEdges);
      window.setTimeout(() => {
        void fitView({ padding: 0.2, duration: 300 });
      }, 60);
    },
    [fitView, replace],
  );

  const imageDefaultParams = settingsDraft.image?.params ?? {};
  const videoDefaultParams = settingsDraft.video?.params ?? {};
  const backgroundPatternColor =
    CANVAS_BACKGROUND_PATTERN_COLORS[
      resolvedTheme === "dark" ? "dark" : "light"
    ][preferences.background];
  const backgroundPatternSize =
    preferences.background === "dots"
      ? 2.4
      : preferences.background === "cross"
        ? 6
        : 1;
  const isMacPlatform =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform);
  const modLabel = isMacPlatform ? "⌘" : "Ctrl";
  const shiftLabel = isMacPlatform ? "⇧" : "Shift";
  const saveStatusLabel = conflict
    ? messages.canvas.versionConflict
    : saving
      ? messages.canvas.saving
      : dirty
        ? messages.canvas.unsaved
        : savedAt
          ? `${messages.canvas.savedLocal} · ${formatDateTime(savedAt)}`
          : messages.canvas.savedLocal;
  const saveStatusColor = conflict
    ? "bg-amber-500"
    : saving
      ? "bg-sky-500 animate-pulse"
      : dirty
        ? "bg-amber-400"
        : "bg-emerald-500";
  const nodeDockId =
    preferences.generationDockPlacement === "node" &&
    configNodeId &&
    configNodeType &&
    (configNodeType === "image" ||
      configNodeType === "video" ||
      configNodeType === "text")
      ? configNodeId
      : null;


  function exportJson() {
    const payload = JSON.stringify(
      { title, graph: toGraph() },
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${title.trim() || "canvas"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }


  function openCanvasInfo() {
    setTitleDraft(title);
    setInfoOpen(true);
  }

  function closeCanvasInfo() {
    setTitleDraft(title);
    setInfoOpen(false);
  }

  function saveCanvasInfo() {
    const next = titleDraft.trim() || messages.canvas.untitled;
    setTitle(next);
    setTitleDraft(next);
    setInfoOpen(false);
  }

  async function uploadThumbnail(file: File) {
    if (thumbnailBusy) {
      return;
    }
    setThumbnailBusy(true);
    try {
      const result = await uploadCanvasThumbnail(canvasDocument.id, file);
      setThumbnailUrl(result.thumbnailUrl);
      toast.success(messages.canvas.thumbnailUploaded);
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : messages.canvas.thumbnailFailed,
      );
    } finally {
      setThumbnailBusy(false);
    }
  }

  async function downloadArchive(kind: "image" | "video") {
    if (archiveBusy) {
      return;
    }
    const candidates = useCanvasStore.getState().nodes.filter(
      (node) =>
        node.type === kind &&
        Boolean(node.data.url || node.data.urls?.length || node.data.assetId),
    );
    if (candidates.length === 0) {
      toast.info(messages.canvas.archiveEmpty);
      return;
    }
    setArchiveMenuOpen(false);
    setArchiveBusy(kind);
    try {
      const result = await downloadCanvasArchive({
        canvasId: canvasDocument.id,
        canvasTitle: title,
        nodes: candidates,
        kind,
      });
      if (result.failed > 0) {
        toast.danger(
          messages.canvas.archivePartial
            .replace("{downloaded}", String(result.downloaded))
            .replace("{failed}", String(result.failed)),
        );
      } else {
        toast.success(
          messages.canvas.archiveDownloaded.replace(
            "{count}",
            String(result.downloaded),
          ),
        );
      }
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : messages.canvas.downloadFailed,
      );
    } finally {
      setArchiveBusy(null);
    }
  }

  async function handleToolbarUpload(files: File[]) {
    if (toolbarUploading || files.length === 0) {
      return;
    }
    const valid: Array<{ file: File; kind: "image" | "video" | "audio" }> = [];
    let failed = 0;
    for (const file of files) {
      const kind = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("audio/")
            ? "audio"
            : null;
      if (kind) {
        valid.push({ file, kind });
      } else {
        failed += 1;
      }
    }
    if (valid.length === 0) {
      toast.danger(messages.canvas.uploadUnsupported);
      return;
    }

    setToolbarUploading(true);
    setToolbarUploadProgress(0);
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    const columns = Math.min(3, valid.length);
    const gapX = 340;
    const gapY = 300;
    const startX = center.x - ((columns - 1) * gapX) / 2;
    let uploadedCount = 0;
    let lastUploadError: string | null = null;

    try {
      for (let index = 0; index < valid.length; index += 1) {
        const { file, kind } = valid[index]!;
        try {
          const uploaded = await uploadPlaygroundAssetWithMeta(file, {
            allowedKinds: [kind],
            filename: file.name || kind,
            onProgress: (percent) => {
              const overall =
                ((index + Math.max(0, Math.min(100, percent)) / 100) /
                  valid.length) *
                100;
              setToolbarUploadProgress(Math.round(overall));
            },
          });
          addMediaNode(
            kind,
            uploaded.url,
            uploaded.assetId || undefined,
            {
              x: startX + (index % columns) * gapX,
              y: center.y + Math.floor(index / columns) * gapY,
            },
            "upload",
          );
          uploadedCount += 1;
        } catch (caught) {
          failed += 1;
          lastUploadError =
            caught instanceof Error && caught.message
              ? caught.message
              : lastUploadError;
        }
      }
      if (uploadedCount > 0 && failed === 0) {
        toast.success(
          messages.canvas.uploadMultipleSuccess.replace(
            "{count}",
            String(uploadedCount),
          ),
        );
      } else if (uploadedCount > 0) {
        toast.danger(
          messages.canvas.uploadPartial
            .replace("{uploaded}", String(uploadedCount))
            .replace("{failed}", String(failed)),
        );
      } else if (
        lastUploadError &&
        lastUploadError !== "UPLOAD_FAILED" &&
        lastUploadError !== "AUTH_REQUIRED" &&
        lastUploadError !== "FILE_TOO_LARGE" &&
        lastUploadError !== "UNSUPPORTED_TYPE"
      ) {
        toast.danger(lastUploadError);
      } else {
        toast.danger(messages.canvas.uploadFailed);
      }
    } finally {
      setToolbarUploading(false);
      setToolbarUploadProgress(0);
    }
  }

  const toolbarVertical = preferences.toolbarPosition !== "bottom";
  const toolbarPanelPosition: "center-left" | "center-right" | "bottom-center" =
    preferences.toolbarPosition === "left"
      ? "center-left"
      : preferences.toolbarPosition === "right"
        ? "center-right"
        : "bottom-center";
  const toolbarSeparatorClass = toolbarVertical
    ? "my-1 h-px w-5 bg-zinc-200 dark:bg-zinc-700"
    : "mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700";

  return (
    <>
      <div className="flex h-full min-h-0 bg-zinc-50 dark:bg-zinc-950">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <input
          ref={thumbnailRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          disabled={thumbnailBusy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void uploadThumbnail(file);
            }
            event.target.value = "";
          }}
        />
        <input
          ref={toolbarUploadRef}
          type="file"
          accept="image/*,video/*,audio/*"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length > 0) {
              void handleToolbarUpload(files);
            }
            event.target.value = "";
          }}
        />

        <CanvasActionsContext.Provider value={actions}>
          <div
            ref={canvasSurfaceRef}
            className={`relative min-h-0 flex-1 ${
              preferences.audioPlayerBorder ? "canvas-audio-bordered" : ""
            } ${selectMode ? "canvas-selecting" : ""} ${
              spacePressed ? "canvas-space-pan" : ""
            }`}
          >
            <CanvasPanningFlag surfaceRef={canvasSurfaceRef} />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-2 pl-1">
              <div className="pointer-events-auto flex min-w-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={messages.canvas.backToCanvas}
                  title={messages.canvas.backToCanvas}
                  onClick={() => push("/canvas")}
                >
                  <Icon icon={ArrowLeft} size={15} />
                </Button>
                <button
                  type="button"
                  className="min-w-0 max-w-[9rem] truncate rounded-md px-1.5 py-1 text-[12px] font-medium text-zinc-700 transition-colors hover:bg-white/50 dark:text-zinc-100 dark:hover:bg-white/10 sm:max-w-[16rem]"
                  title={messages.canvas.canvasInfo}
                  onClick={openCanvasInfo}
                >
                  {title.trim() || messages.canvas.untitled}
                </button>
                <Tooltip content={saveStatusLabel}>
                  <span
                    className={`mx-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${saveStatusColor}`}
                    aria-hidden="true"
                  />
                </Tooltip>
              </div>
              <div className="pointer-events-auto flex shrink-0 items-center gap-1 pt-0.5">
                <div className="flex items-center gap-0.5">
                <Tooltip content={messages.canvas.shortcuts}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={messages.canvas.shortcuts}
                    onClick={() => setShortcutsOpen(true)}
                  >
                    <Icon icon={Keyboard} size={14} />
                  </Button>
                </Tooltip>
                <Tooltip content={messages.canvas.downloadAssets}>
                  <Button
                    ref={archiveButtonRef}
                    variant="ghost"
                    size="icon-sm"
                    aria-label={messages.canvas.downloadAssets}
                    aria-expanded={archiveMenuOpen}
                    disabled={archiveBusy !== null}
                    onClick={() => setArchiveMenuOpen((open) => !open)}
                  >
                    <Icon
                      icon={
                        archiveBusy ? CircleNotch : DownloadSimple
                      }
                      size={14}
                      className={archiveBusy ? "animate-spin" : ""}
                    />
                  </Button>
                </Tooltip>
                <Popover
                  open={archiveMenuOpen}
                  onOpenChange={setArchiveMenuOpen}
                  anchorRef={archiveButtonRef}
                  placement="bottom"
                  role="menu"
                  ariaLabel={messages.canvas.downloadAssets}
                  minWidth={220}
                  className="p-1"
                >
                  <div className="space-y-0.5">
                    <button
                      type="button"
                      role="menuitem"
                      disabled={downloadableImages === 0 || archiveBusy !== null}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      onClick={() => void downloadArchive("image")}
                    >
                      <Icon icon={ImageSquare} size={14} />
                      <span className="min-w-0 flex-1">
                        {messages.canvas.downloadImages}
                      </span>
                      <span className="tabular-nums text-[10px] text-zinc-400">
                        {downloadableImages}
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={downloadableVideos === 0 || archiveBusy !== null}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      onClick={() => void downloadArchive("video")}
                    >
                      <Icon icon={VideoCamera} size={14} />
                      <span className="min-w-0 flex-1">
                        {messages.canvas.downloadVideos}
                      </span>
                      <span className="tabular-nums text-[10px] text-zinc-400">
                        {downloadableVideos}
                      </span>
                    </button>
                  </div>
                </Popover>
                </div>
                <span className="h-5 w-px bg-zinc-200/80 dark:bg-zinc-700/80" />
                <Tooltip content={messages.canvas.modelSettings}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={messages.canvas.modelSettings}
                    onClick={openModelSettings}
                  >
                    <Icon
                      icon={Brain}
                      size={15}
                      className={
                        isGenerationConfigured()
                          ? "text-zinc-500 dark:text-zinc-300"
                          : "text-amber-500"
                      }
                    />
                  </Button>
                </Tooltip>
                <Tooltip content={messages.canvas.connectAgent}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={messages.canvas.connectAgent}
                    onClick={() => setConnectAgentOpen(true)}
                  >
                    <Icon
                      icon={Plugs}
                      size={15}
                      className={
                        agentTokenActive
                          ? "text-sky-500"
                          : "text-zinc-500 dark:text-zinc-300"
                      }
                    />
                  </Button>
                </Tooltip>
                <Tooltip
                  content={`${messages.canvas.agentChat} (${modLabel}+\\)`}
                >
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={messages.canvas.agentChat}
                    onClick={() => setAgentChatOpen((current) => !current)}
                  >
                    <Icon
                      icon={ChatCircle}
                      size={15}
                      className={
                        agentChatOpen
                          ? "text-sky-500"
                          : "text-zinc-500 dark:text-zinc-300"
                      }
                    />
                  </Button>
                </Tooltip>
                <span className="h-5 w-px bg-zinc-200/80 dark:bg-zinc-700/80" />
                <div className="flex items-center gap-0.5">
                  <Tooltip
                    content={
                      activeRun
                        ? messages.canvas.runCancel
                        : messages.canvas.runMenu
                    }
                  >
                    <Button
                      ref={runMenuButtonRef}
                      variant="ghost"
                      size="icon-sm"
                      className={
                        activeRun
                          ? "text-red-500 hover:text-red-600"
                          : "text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
                      }
                      aria-label={
                        activeRun
                          ? messages.canvas.runCancel
                          : messages.canvas.runMenu
                      }
                      aria-expanded={!activeRun && runMenuOpen}
                      onClick={() => {
                        if (activeRun) {
                          cancelActiveRun();
                          return;
                        }
                        setRunMenuOpen((open) => !open);
                      }}
                    >
                      <Icon
                        icon={activeRun ? StopCircle : Play}
                        size={14}
                      />
                    </Button>
                  </Tooltip>
                  <Popover
                    open={runMenuOpen && !activeRun}
                    onOpenChange={setRunMenuOpen}
                    anchorRef={runMenuButtonRef}
                    placement="bottom"
                    role="menu"
                    ariaLabel={messages.canvas.runMenu}
                    minWidth={190}
                    className="p-1"
                  >
                    <div className="space-y-0.5">
                      {(
                        [
                          ["all", messages.canvas.runAll],
                          ["selected", messages.canvas.runSelected],
                          ["from", messages.canvas.runFrom],
                          ["retry-failed", messages.canvas.retryFailed],
                        ] as const
                      ).map(([mode, label]) => (
                        <button
                          key={mode}
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          onClick={() => prepareRun(mode)}
                        >
                          {label}
                        </button>
                      ))}
                      <div className="border-t border-zinc-100 pt-1 dark:border-zinc-800">
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          onClick={() => {
                            setRunMenuOpen(false);
                            setTasksTab("history");
                            setTasksOpen(true);
                          }}
                        >
                          <Icon icon={Clock} size={13} />
                          {messages.canvas.runHistory}
                        </button>
                      </div>
                    </div>
                  </Popover>
                </div>
                <span className="h-5 w-px bg-zinc-200/80 dark:bg-zinc-700/80" />
                <div className="flex items-center gap-0.5">
                  <LocaleToggle />
                  <ThemeToggle />
                </div>
              </div>
            </div>

            <CanvasConflictBanner
              open={conflict}
              onKeepMine={forceSaveMine}
              onLoadRemote={discardAndLoadRemote}
            />

            {insertMenu ? (
              <>
                <div
                  className="absolute inset-0 z-40"
                  onPointerDown={() => setInsertMenu(null)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setInsertMenu(null);
                  }}
                />
                <div
                  className="absolute z-50 w-52 rounded-xl border border-zinc-200 bg-white/95 p-1 shadow-xl backdrop-blur-xl dark:border-zinc-700 dark:bg-zinc-900/95"
                  style={{ left: insertMenu.left, top: insertMenu.top }}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <p className="px-2 pb-1 pt-1.5 text-[10px] font-medium text-zinc-400">
                    {insertMenu.connectFrom
                      ? messages.canvas.insertNodeAndConnect
                      : messages.canvas.insertNode}
                  </p>
                  {(insertMenu.connectFrom
                    ? (
                        [
                          ["text", messages.canvas.addText, TextT],
                          ["image", messages.canvas.addImage, ImageSquare],
                          ["video", messages.canvas.addVideo, VideoCamera],
                          ["audio", messages.canvas.addAudio, Waveform],
                        ] as const
                      ).filter(([type]) =>
                        insertMenu.connectFrom?.allowedTypes.includes(type),
                      )
                    : (
                        [
                          ["text", messages.canvas.addText, TextT],
                          ["image", messages.canvas.addImage, ImageSquare],
                          ["video", messages.canvas.addVideo, VideoCamera],
                          ["audio", messages.canvas.addAudio, Waveform],
                          ["group", messages.canvas.addGroup, FolderPlus],
                        ] as const
                      )
                  ).map(([type, label, icon]) => (
                    <button
                      key={type}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      onClick={() => {
                        const connectFrom = insertMenu.connectFrom;
                        const nodeId = addNodeWithPreset(type, insertMenu.flow);
                        if (connectFrom && type !== "group") {
                          useCanvasStore
                            .getState()
                            .onConnect(
                              connectionFromConnectDrop({
                                newNodeId: nodeId,
                                newNodeType: type,
                                connectFrom,
                              }),
                            );
                        }
                        setInsertMenu(null);
                      }}
                    >
                      <Icon icon={icon} size={14} className="text-zinc-400" />
                      {label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            <CanvasPreferencesProvider value={preferences}>
              <CanvasFlowSurface
                preferences={preferences}
                colorMode={resolvedTheme === "dark" ? "dark" : "light"}
                panOnDrag={viewportLocked ? false : selectMode ? [1] : true}
                selectionOnDrag={!viewportLocked && selectMode}
                zoomEnabled={!viewportLocked}
                showHelperLines={preferences.showHelperLines}
                onDragStart={handleDragStart}
                onNodeClick={(_, node) => {
                  setInsertMenu(null);
                  const isMedia = node.type === "image" || node.type === "video";
                  const configurable = isMedia || node.type === "text";
                  setConfigNodeId(configurable ? node.id : null);
                }}
                onPaneClick={() => {
                  setConfigNodeId(null);
                  setInsertMenu(null);
                }}
                onPaneContextMenu={(event) => {
                  event.preventDefault();
                  const rect =
                    canvasSurfaceRef.current?.getBoundingClientRect();
                  if (!rect) {
                    return;
                  }
                  setInsertMenu({
                    left: Math.min(
                      Math.max(8, event.clientX - rect.left),
                      Math.max(8, rect.width - 216),
                    ),
                    top: Math.min(
                      Math.max(12, event.clientY - rect.top),
                      Math.max(12, rect.height - 280),
                    ),
                    flow: screenToFlowPosition({
                      x: event.clientX,
                      y: event.clientY,
                    }),
                  });
                }}
                onMoveEnd={(_, viewport) => syncViewport(viewport)}
                onConnectDrop={({ clientX, clientY, connectFrom }) => {
                  const rect =
                    canvasSurfaceRef.current?.getBoundingClientRect();
                  if (!rect) {
                    return;
                  }
                  setInsertMenu({
                    left: Math.min(
                      Math.max(8, clientX - rect.left),
                      Math.max(8, rect.width - 216),
                    ),
                    top: Math.min(
                      Math.max(12, clientY - rect.top),
                      Math.max(12, rect.height - 280),
                    ),
                    flow: screenToFlowPosition({ x: clientX, y: clientY }),
                    connectFrom,
                  });
                }}
                highlightedNodeId={highlightedNodeId}
              >
                <CanvasHelperLinesOverlay />
                <CanvasBackdrop
                  preferences={preferences}
                  patternSize={backgroundPatternSize}
                  patternColor={backgroundPatternColor}
                />
                <CanvasToolbar
                  addAtCenter={addAtCenter}
                  addGroupAtCenter={addGroupAtCenter}
                  applyAutoLayout={applyAutoLayout}
                  autoLayoutModeLabel={autoLayoutModeLabel}
                  history={history}
                  layoutMenuButtonRef={layoutMenuButtonRef}
                  layoutMenuOpen={layoutMenuOpen}
                  openCanvasSettings={openCanvasSettings}
                  preferences={preferences}
                  selectMode={selectMode}
                  setAssetLibraryOpen={setAssetLibraryOpen}
                  setGroupName={setGroupName}
                  setGroupOpen={setGroupOpen}
                  setLayoutMenuOpen={setLayoutMenuOpen}
                  setNodeInfoOpen={setNodeInfoOpen}
                  setPreferences={setPreferences}
                  setSelectMode={setSelectMode}
                  setTasksOpen={setTasksOpen}
                  setTasksTab={setTasksTab}
                  toolbarPanelPosition={toolbarPanelPosition}
                  toolbarSeparatorClass={toolbarSeparatorClass}
                  toolbarUploadProgress={toolbarUploadProgress}
                  toolbarUploadRef={toolbarUploadRef}
                  toolbarUploading={toolbarUploading}
                  toolbarVertical={toolbarVertical}
                  modLabel={modLabel}
                  shiftLabel={shiftLabel}
                />
                <CanvasBottomDock
                  onZoomIn={() => void zoomIn({ duration: 150 })}
                  onZoomOut={() => void zoomOut({ duration: 150 })}
                  onFitView={() => void fitView({ padding: 0.2, duration: 250 })}
                  viewportLocked={viewportLocked}
                  onToggleLock={() => setViewportLocked((locked) => !locked)}
                  snapToGrid={preferences.snapToGrid}
                  onToggleSnap={() =>
                    setPreferences((current) => ({
                      ...current,
                      snapToGrid: !current.snapToGrid,
                    }))
                  }
                  showMiniMap={preferences.showMiniMap}
                  onToggleMiniMap={() =>
                    setPreferences((current) => ({
                      ...current,
                      showMiniMap: !current.showMiniMap,
                    }))
                  }
                />
              </CanvasFlowSurface>
            </CanvasPreferencesProvider>

            <CanvasSelectionBar
              onCreateGroup={(count) => {
                setGroupName(`${messages.canvas.groupDefault} ${count}`);
                setGroupOpen(true);
              }}
            />


            <CanvasNodeDockSlot
              nodeId={nodeDockId}
              onClose={() => setConfigNodeId(null)}
            />
          </div>

          <CanvasGenerationDock
            nodeId={configNodeId}
            preferences={preferences}
            onClose={() => setConfigNodeId(null)}
          />
        </CanvasActionsContext.Provider>
      </div>

      <CanvasAgentChatPanel
        canvasId={canvasDocument.id}
        context={agentChatContext}
        selectionChips={selectionChips}
        onRemoveSelection={removeSelection}
        onAgentFocusNode={highlightAgentNode}
        chatModels={chatModels}
        defaultModelId={settings.text?.model}
        open={agentChatOpen}
        onOpenChange={setAgentChatOpen}
        onOpenModelSettings={openModelSettings}
        onGraphMutated={handleAgentChatGraphMutated}
      />
      </div>

      {assetLibraryOpen ? (
        <CanvasAssetLibraryDialog
          onClose={() => setAssetLibraryOpen(false)}
          onConfirm={(items) => {
            const valid = items.filter(
              (item) =>
                item.mediaType === "image" ||
                item.mediaType === "video" ||
                item.mediaType === "audio",
            );
            if (valid.length > 0) {
              const center = screenToFlowPosition({
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
              });
              const columns = Math.min(3, valid.length);
              const startX = center.x - ((columns - 1) * 340) / 2;
              valid.forEach((item, index) => {
                addMediaNode(
                  item.mediaType as "image" | "video" | "audio",
                  item.url,
                  item.id,
                  {
                    x: startX + (index % columns) * 340,
                    y: center.y + Math.floor(index / columns) * 300,
                  },
                  "library",
                  item.thumbnailUrl ?? undefined,
                );
              });
              toast.success(messages.canvas.assetSelected);
            }
            setAssetLibraryOpen(false);
          }}
          onUpload={() => {
            setAssetLibraryOpen(false);
            toolbarUploadRef.current?.click();
          }}
          storageConfigured={storageConfigured}
          onConfigureStorage={() => {
            setAssetLibraryOpen(false);
            openCanvasSettings("storage");
          }}
        />
      ) : null}

      <CanvasRunConfirmModal
        open={Boolean(runConfirm)}
        count={runSummary?.count ?? runConfirm?.plan.nodeIds.length ?? 0}
        overwrite={runSummary?.overwrite ?? 0}
        costLabel={
          runCostEstimate && runCostEstimate.priced > 0
            ? `${currencySymbol}${runCostEstimate.total}`
            : "—"
        }
        typeMix={(["image", "video", "audio", "text"] as const)
          .filter((type) => (runSummary?.byType[type] ?? 0) > 0)
          .map((type) => ({ type, count: runSummary?.byType[type] ?? 0 }))}
        upstreamCount={runSummary?.upstream ?? 0}
        showUpstreamToggle={runHasUpstream}
        includeUpstream={Boolean(runConfirm?.includeUpstream)}
        onIncludeUpstreamChange={setRunIncludeUpstream}
        rows={runRows}
        total={runConfirm?.plan.nodeIds.length ?? 0}
        expanded={runListExpanded}
        onToggleExpand={() => setRunListExpanded((current) => !current)}
        unpriced={Boolean(runCostEstimate && runCostEstimate.unpriced > 0)}
        onClose={() => setRunConfirm(null)}
        onStart={() => void startPlanRun()}
      />

      {shortcutsOpen ? (
      <CanvasShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      ) : null}

      {tasksOpen ? (
      <CanvasRunningTasksModal
        open={tasksOpen}
        onRerun={(nodeIds) => prepareRun("node", nodeIds)}
        onClose={() => setTasksOpen(false)}
        canvasId={canvasDocument.id}
        tab={tasksTab}
        onTabChange={setTasksTab}
        runActive={Boolean(activeRun || agentRunId)}
        onCancelRun={cancelActiveRun}
      />
      ) : null}

      <CanvasOverlays
        infoOpen={infoOpen}
        titleDraft={titleDraft}
        setTitleDraft={setTitleDraft}
        thumbnailUrl={thumbnailUrl}
        thumbnailBusy={thumbnailBusy}
        thumbnailRef={thumbnailRef}
        canvasDocument={canvasDocument}
        savedAt={savedAt}
        exportJson={exportJson}
        saveCanvasInfo={saveCanvasInfo}
        closeCanvasInfo={closeCanvasInfo}
        modelSettingsOpen={modelSettingsOpen}
        setModelSettingsOpen={setModelSettingsOpen}
        setByokRevision={setByokRevision}
        connectAgentOpen={connectAgentOpen}
        setConnectAgentOpen={setConnectAgentOpen}
        setAgentTokenActive={setAgentTokenActive}
        canvasSettings={canvasSettings}
        chatModels={chatModels}
        imageModels={imageModels}
        videoModels={videoModels}
        imageDefaultParams={imageDefaultParams}
        videoDefaultParams={videoDefaultParams}
        nodeInfoOpen={nodeInfoOpen}
        setNodeInfoOpen={setNodeInfoOpen}
        groupOpen={groupOpen}
        groupName={groupName}
        setGroupName={setGroupName}
        setGroupOpen={setGroupOpen}
        onOpenAgentChat={() => setAgentChatOpen(true)}
      />
    </>
  );
}

/**
 * Media library dialog. Mounted only while open, so the (O(n)) scan that builds
 * the "already on this canvas" url set stays off the canvas render path.
 */
function CanvasAssetLibraryDialog({
  onClose,
  onConfirm,
  onUpload,
  storageConfigured,
  onConfigureStorage,
}: {
  onClose: () => void;
  onConfirm: ComponentProps<typeof PlaygroundMediaLibraryPicker>["onConfirm"];
  onUpload: () => void;
  storageConfigured: boolean;
  onConfigureStorage: () => void;
}) {
  const selectedUrls = useCanvasStore(
    useShallow((state) => getCanvasMediaUrls(state.nodes)),
  );
  return (
    <PlaygroundMediaLibraryPicker
      open
      onClose={onClose}
      allowedMediaTypes={["image", "video", "audio"]}
      selectedUrls={selectedUrls}
      onConfirm={onConfirm}
      onUpload={onUpload}
      storageConfigured={storageConfigured}
      onConfigureStorage={onConfigureStorage}
    />
  );
}

export function CanvasEditor({ canvasId }: { canvasId: string }) {
  const { push } = useLocaleRouter();
  const query = usePortalQuery(`portal-canvas-${canvasId}`, () =>
    getCanvas(canvasId),
  );

  if (query.loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-zinc-400">
        <Loading variant="dots" size={20} label={messages.loading} />
        {messages.loading}
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          {messages.canvas.notFound}
        </p>
        <p className="max-w-sm text-xs text-zinc-400">
          {query.error ?? messages.canvas.notFoundBody}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={query.reload}>
            {messages.canvas.reload}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => push("/canvas")}>
            {messages.canvas.backToCanvas}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <CanvasEditorInner
        key={`${query.data.id}:${query.data.version}`}
        canvasDocument={query.data}
      />
    </ReactFlowProvider>
  );
}
