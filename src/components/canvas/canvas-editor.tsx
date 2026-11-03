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
import {
  ReactFlow,
  ReactFlowProvider,
  ConnectionLineType,
  SelectionMode,
  type Connection,
  type Edge,
  type NodeChange,
  type NodePositionChange,
  type OnConnect,
  type OnNodeDrag,
  useReactFlow,
  useStore,
  ViewportPortal,
} from "@xyflow/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CanvasActionsContext } from "@/components/canvas/canvas-actions";
import { canvasEdgeTypes } from "@/components/canvas/canvas-edge";
import { CanvasNodeLabels } from "@/components/canvas/canvas-node-labels";
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
import { CanvasDetailProvider } from "@/components/canvas/canvas-detail-context";
import { CanvasGenerationDock } from "@/components/canvas/editor/chrome/canvas-generation-dock";
import { CanvasNodeDockSlot } from "@/components/canvas/editor/chrome/canvas-node-dock-slot";
import { CanvasOverlays } from "@/components/canvas/editor/chrome/canvas-overlays";
import { CanvasSelectionBar } from "@/components/canvas/editor/chrome/canvas-selection-bar";
import { CanvasBackdrop } from "@/components/canvas/editor/chrome/canvas-backdrop";
import { CanvasBottomDock } from "@/components/canvas/editor/chrome/canvas-bottom-dock";
import { CanvasConflictBanner } from "@/components/canvas/editor/chrome/canvas-conflict-banner";
import { CanvasToolbar } from "@/components/canvas/editor/chrome/canvas-toolbar";
import { CanvasRunConfirmModal } from "@/components/canvas/editor/panels/canvas-run-confirm-modal";
import { canvasNodeTypes } from "@/components/canvas/canvas-node-types";
import {
  getHelperLines,
  type CanvasHelperLines,
} from "@/lib/canvas/canvas-helper-lines";


import { LocaleToggle } from "@/components/locale-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
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
  CANVAS_EDGE_COLORS,
  canvasEdgeDashArray,
  loadCanvasPreferences,
  saveCanvasPreferences,
  type CanvasPreferences,
} from "@/lib/canvas/canvas-preferences";
import { edgeRoleOptions } from "@/lib/canvas/canvas-edge-roles";
import { stableGraphJson } from "@/lib/canvas/canvas-graph-json";
import { downloadCanvasArchive } from "@/lib/canvas/canvas-archive";
import {
  canvasLayoutPositionsEqual,
  layoutCanvasNodes,
  type CanvasAutoLayoutMode,
} from "@/lib/canvas/canvas-auto-layout";
import {
} from "@/lib/canvas/canvas-runner";
import {
  useCanvasStore,
  type CanvasFlowNode,
} from "@/lib/canvas/canvas-store";
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




import {
  CANVAS_ANIMATED_EDGE_LIMIT,
  CANVAS_BACKGROUND_PATTERN_COLORS,
  CANVAS_CONNECTION_SNAP_RADIUS,
  CANVAS_DEFAULT_FIT_VIEW_OPTIONS,
  CANVAS_DEFAULT_VIEWPORT,
  CANVAS_LOD_ZOOM,
  CANVAS_MAX_ZOOM,
  CANVAS_MIN_ZOOM,
  CANVAS_SNAP_DISTANCE,
} from "@/components/canvas/editor/lib/constants";
import type { RunConfirmState } from "@/components/canvas/editor/lib/run-plan-view";
import { nodeTypeLabel } from "@/components/canvas/editor/lib/node-display";
import { isCanvasConnectionValid } from "@/components/canvas/editor/lib/geometry";


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
  const [draggingNode, setDraggingNode] = useState(false);
  const [helperLines, setHelperLines] = useState<CanvasHelperLines | null>(
    null,
  );
  const runMenuButtonRef = useRef<HTMLButtonElement>(null);
  const [archiveMenuOpen, setArchiveMenuOpen] = useState(false);
  const [insertMenu, setInsertMenu] = useState<{
    left: number;
    top: number;
    flow: { x: number; y: number };
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

  const nodes = useCanvasStore((state) => state.nodes);

  const {
    viewportZoom,
    visibleNodeIds,
    canvasDetail,
    syncViewport,
    viewportLocked,
    setViewportLocked,
  } = useCanvasViewport();

  // Pan start/end only (not per frame): used to shed expensive paint work
  // (edge animation, blur, shadows) while the viewport is moving.
  const paneDragging = useStore((state) => state.paneDragging);

  const edges = useCanvasStore((state) => state.edges);
  const selectedNodes = useMemo(
    () =>
      nodes.filter(
        (node) => node.selected && node.type !== "group" && !node.parentId,
      ),
    [nodes],
  );
  /**
   * Run planning needs every selected node, including group containers (their
   * children get expanded) and nodes nested inside a group.
   */
  // Viewport changes every frame while panning; keep only what we need as
  // state, refreshed when the gesture ends (a re-render per frame is costly).

  const selectedIdsKey = useCanvasStore((state) =>
    state.nodes
      .filter((node) => node.selected)
      .map((node) => node.id)
      .join(","),
  );

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
      if (!visibleNodeIds.includes(nodeId)) {
        setCenter(x + width / 2, y + height / 2, {
          zoom: viewportZoom || 1,
          duration: 450,
        });
      }
    },
    [viewportZoom, setCenter, visibleNodeIds],
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

  const librarySelectedUrls = useMemo(
    () =>
      Array.from(
        new Set(
          nodes.flatMap((node) =>
            [node.data.url, ...(node.data.urls ?? [])].filter(
              (url): url is string => Boolean(url?.trim()),
            ),
          ),
        ),
      ),
    [nodes],
  );
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
  const groupSelection = useCanvasStore((state) => state.groupSelection);
  const addNodesToGroup = useCanvasStore((state) => state.addNodesToGroup);
  const setNodePosition = useCanvasStore((state) => state.setNodePosition);
  const setDragOverGroupId = useCanvasStore(
    (state) => state.setDragOverGroupId,
  );
  const setSnapTargetId = useCanvasStore(
    (state) => state.setSnapTargetId,
  );
  const onNodesChange = useCanvasStore((state) => state.onNodesChange);
  const onEdgesChange = useCanvasStore((state) => state.onEdgesChange);
  const onConnect = useCanvasStore((state) => state.onConnect);
  const addNode = useCanvasStore((state) => state.addNode);
  const selectAll = useCanvasStore((state) => state.selectAll);
  const clearSelection = useCanvasStore((state) => state.clearSelection);
  const addMediaNode = useCanvasStore((state) => state.addMediaNode);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const removeNode = useCanvasStore((state) => state.removeNode);
  const duplicateNode = useCanvasStore((state) => state.duplicateNode);
  const replace = useCanvasStore((state) => state.replace);
  const toGraph = useCanvasStore((state) => state.toGraph);




  const history = useCanvasHistory({ nodes, edges, apply: replace });

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
    nodes,
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
    nodes,
    edges,
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

  const isValidConnection = useCallback(
    (connection: Connection | Edge) =>
      isCanvasConnectionValid(connection, nodes, edges),
    [edges, nodes],
  );

  /** Multi-select: drag from one selected source → also wire other selected sources. */
  const handleConnect = useCallback(
    (connection: Connection) => {
      onConnect(connection);

      const sourceId = connection.source;
      const targetId = connection.target;
      if (!sourceId || !targetId) {
        return;
      }

      const state = useCanvasStore.getState();
      const selectedSourceIds = state.nodes
        .filter(
          (node) =>
            node.selected &&
            node.type !== "group" &&
            !node.parentId &&
            node.id !== targetId,
        )
        .map((node) => node.id);

      if (
        selectedSourceIds.length < 2 ||
        !selectedSourceIds.includes(sourceId)
      ) {
        return;
      }

      const targetHandle = connection.targetHandle ?? "in";
      const sourceHandle = connection.sourceHandle ?? "out";
      let connectedCount = 1;

      for (const extraSourceId of selectedSourceIds) {
        if (extraSourceId === sourceId) {
          continue;
        }
        const nextConnection: Connection = {
          source: extraSourceId,
          target: targetId,
          sourceHandle,
          targetHandle,
        };
        const latest = useCanvasStore.getState();
        const alreadyLinked = latest.edges.some(
          (edge) =>
            edge.source === extraSourceId &&
            edge.target === targetId &&
            (edge.targetHandle ?? "in") === targetHandle,
        );
        if (alreadyLinked) {
          continue;
        }
        if (
          !isCanvasConnectionValid(
            nextConnection,
            latest.nodes,
            latest.edges,
          )
        ) {
          continue;
        }
        onConnect(nextConnection);
        connectedCount += 1;
      }

      if (connectedCount > 1) {
        toast.success(
          messages.canvas.batchConnected.replace(
            "{count}",
            String(connectedCount),
          ),
        );
      }
    },
    [onConnect],
  );

  const addNodeWithPreset = useCallback(
    (
      type: "text" | "image" | "video" | "audio" | "group",
      position: { x: number; y: number },
    ) => {
      if (type === "group") {
        addNode("group", position, { label: messages.canvas.groupDefault });
        return;
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
      addNode(type, position, data);
    },
    [addNode, settings],
  );

  const addAtCenter = useCallback(
    (type: "text" | "image" | "video" | "audio") => {
      addNodeWithPreset(
        type,
        screenToFlowPosition({
          x: window.innerWidth / 2 + nodes.length * 12,
          y: window.innerHeight / 2 + nodes.length * 12,
        }),
      );
    },
    [addNodeWithPreset, nodes.length, screenToFlowPosition],
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
    nodes,
    refreshCanvas,
    selectedNodes,
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

  const configNode = useMemo(
    () => nodes.find((node) => node.id === configNodeId),
    [configNodeId, nodes],
  );


  const runStatusById = useCanvasRunStatusStore((state) => state.statusById);
  const runningTaskCount = useMemo(
    () =>
      nodes.filter((node) => {
        const status = runStatusById[node.id]?.status ?? node.data.status;
        return status === "running" || status === "queued";
      }).length,
    [nodes, runStatusById],
  );
  const downloadableImages = useMemo(
    () =>
      nodes.filter(
        (node) =>
          node.type === "image" &&
          Boolean(node.data.url || node.data.urls?.length || node.data.assetId),
      ).length,
    [nodes],
  );
  const downloadableVideos = useMemo(
    () =>
      nodes.filter(
        (node) =>
          node.type === "video" &&
          Boolean(node.data.url || node.data.urls?.length || node.data.assetId),
      ).length,
    [nodes],
  );
  const autoLayoutModeLabel =
    preferences.autoLayoutMode === "layered-tb"
      ? messages.canvas.autoLayoutLayeredTb
      : preferences.autoLayoutMode === "grid"
        ? messages.canvas.autoLayoutGrid
        : messages.canvas.autoLayoutLayeredLr;

  const applyAutoLayout = useCallback(
    (mode: CanvasAutoLayoutMode) => {
      const next = layoutCanvasNodes(nodes, edges, mode);
      if (next === nodes || canvasLayoutPositionsEqual(nodes, next)) {
        toast.info(messages.canvas.autoLayoutNoChange);
        return;
      }
      replace(next, edges);
      window.setTimeout(() => {
        void fitView({ padding: 0.2, duration: 300 });
      }, 60);
    },
    [edges, fitView, nodes, replace],
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
  const edgeStroke = CANVAS_EDGE_COLORS[preferences.edgeColor];
  const edgeDash = canvasEdgeDashArray(preferences.edgeLineStyle);
  const connectionLineType =
    preferences.edgeType === "bezier"
      ? ConnectionLineType.Bezier
      : preferences.edgeType === "straight"
        ? ConnectionLineType.Straight
        : ConnectionLineType.SmoothStep;
  const connectionLineStyle = useMemo(
    () => ({
      stroke: edgeStroke,
      strokeWidth: preferences.edgeWidth,
      ...(edgeDash ? { strokeDasharray: edgeDash } : {}),
    }),
    [edgeDash, edgeStroke, preferences.edgeWidth],
  );
  const animateEdges = useMemo(
    () =>
      preferences.animateEdges && edges.length <= CANVAS_ANIMATED_EDGE_LIMIT,
    [edges.length, preferences.animateEdges],
  );
  const defaultEdgeOptions = useMemo(
    () => ({
      type: "canvas" as const,
      animated: animateEdges,
      style: connectionLineStyle,
    }),
    [animateEdges, connectionLineStyle],
  );

  // React Flow animates an edge when `edge.animated` is set, so the cap has to
  // be applied at render time for edges that were created earlier.
  const renderedEdges = useMemo(() => {
    const needsNormalisation = edges.some(
      (edge) => Boolean(edge.animated) !== animateEdges,
    );
    if (!needsNormalisation) {
      return edges;
    }
    return edges.map((edge) =>
      edge.animated === animateEdges ? edge : { ...edge, animated: animateEdges },
    );
  }, [animateEdges, edges]);

  const nodeDock =
    preferences.generationDockPlacement === "node" &&
    configNode &&
    (configNode.type === "image" ||
      configNode.type === "video" ||
      configNode.type === "text")
      ? configNode
      : null;


  const groupAtNode = (node: CanvasFlowNode) => {
    if (node.type === "group" || node.parentId) {
      return undefined;
    }
    const width = node.measured?.width ?? node.width ?? 240;
    const height = node.measured?.height ?? node.height ?? 200;
    const centerX = node.position.x + width / 2;
    const centerY = node.position.y + height / 2;
    return [...nodes].reverse().find((item) => {
      if (item.type !== "group") {
        return false;
      }
      const groupWidth = item.width ?? item.measured?.width ?? 360;
      const groupHeight = item.height ?? item.measured?.height ?? 280;
      return (
        centerX >= item.position.x &&
        centerX <= item.position.x + groupWidth &&
        centerY >= item.position.y &&
        centerY <= item.position.y + groupHeight
      );
    });
  };

  const snapCandidateFor = (node: CanvasFlowNode) => {
    if (!preferences.autoConnect) {
      return null;
    }
    if (node.type === "group" || node.parentId) {
      return null;
    }
    const width = node.measured?.width ?? node.width ?? 240;
    const height = node.measured?.height ?? node.height ?? 200;
    const left = node.position.x;
    const top = node.position.y;
    const right = left + width;
    const bottom = top + height;
    let best: {
      id: string;
      gap: number;
      sourceId: string;
      targetId: string;
    } | null = null;
    for (const candidate of nodes) {
      if (
        candidate.id === node.id ||
        candidate.type === "group" ||
        candidate.parentId
      ) {
        continue;
      }
      const candidateWidth =
        candidate.measured?.width ?? candidate.width ?? 280;
      const candidateHeight =
        candidate.measured?.height ?? candidate.height ?? 200;
      const candidateLeft = candidate.position.x;
      const candidateTop = candidate.position.y;
      const candidateRight = candidateLeft + candidateWidth;
      const candidateBottom = candidateTop + candidateHeight;
      const gapX = Math.max(
        0,
        Math.max(left, candidateLeft) - Math.min(right, candidateRight),
      );
      const gapY = Math.max(
        0,
        Math.max(top, candidateTop) - Math.min(bottom, candidateBottom),
      );
      const gap = Math.hypot(gapX, gapY);
      if (gap > CANVAS_SNAP_DISTANCE || (best && gap >= best.gap)) {
        continue;
      }
      const forward = edgeRoleOptions(node.type, candidate.type).length > 0;
      const backward = edgeRoleOptions(candidate.type, node.type).length > 0;
      if (!forward && !backward) {
        continue;
      }
      if (
        edges.some(
          (edge) =>
            (edge.source === node.id && edge.target === candidate.id) ||
            (edge.source === candidate.id && edge.target === node.id),
        )
      ) {
        continue;
      }
      const sourceId = forward ? node.id : candidate.id;
      const targetId = forward ? candidate.id : node.id;
      if (
        !isValidConnection({
          source: sourceId,
          target: targetId,
          sourceHandle: "out",
          targetHandle: "in",
        })
      ) {
        continue;
      }
      best = { id: candidate.id, gap, sourceId, targetId };
    }
    return best;
  };

  const handleNodesChange = useCallback(
    (changes: NodeChange<CanvasFlowNode>[]) => {
      if (!preferences.showHelperLines) {
        onNodesChange(changes);
        return;
      }

      const positionChange = changes.find(
        (change): change is NodePositionChange =>
          change.type === "position" &&
          change.dragging === true &&
          Boolean(change.position),
      );

      if (!positionChange?.position) {
        onNodesChange(changes);
        return;
      }

      const result = getHelperLines(positionChange, nodes);
      if (result.snapPosition.x !== undefined) {
        positionChange.position.x = result.snapPosition.x;
      }
      if (result.snapPosition.y !== undefined) {
        positionChange.position.y = result.snapPosition.y;
      }
      setHelperLines({
        horizontal: result.horizontal,
        vertical: result.vertical,
      });
      onNodesChange(changes);
    },
    [nodes, onNodesChange, preferences.showHelperLines],
  );

  const handleNodeDragStart: OnNodeDrag<CanvasFlowNode> = () => {
    setDraggingNode(true);
    setHelperLines(null);
    setDragOverGroupId(null);
    setSnapTargetId(null);
    setInsertMenu(null);
  };

  const handleNodeDragStop: OnNodeDrag<CanvasFlowNode> = (_event, node) => {
    setDraggingNode(false);
    setHelperLines(null);
    const group = groupAtNode(node);
    const snap = snapCandidateFor(node);
    setDragOverGroupId(null);
    setSnapTargetId(null);
    if (group) {
      addNodesToGroup(group.id, [node.id]);
      toast.success(messages.canvas.groupNodeAdded);
      return;
    }
    if (snap) {
      onConnect({
        source: snap.sourceId,
        target: snap.targetId,
        sourceHandle: "out",
        targetHandle: "in",
      });
      toast.success(messages.canvas.autoConnected);
    }
  };

  const handleNodeDrag: OnNodeDrag<CanvasFlowNode> = (_event, node) => {
    if (node.parentId) {
      setNodePosition(node.id, node.position.x, node.position.y);
      setDragOverGroupId(null);
      setSnapTargetId(null);
      return;
    }
    setDragOverGroupId(groupAtNode(node)?.id ?? null);
    setSnapTargetId(snapCandidateFor(node)?.id ?? null);
  };

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
    const candidates = nodes.filter(
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
            data-panning={paneDragging ? "true" : undefined}
            className={`relative min-h-0 flex-1 ${
              preferences.audioPlayerBorder ? "canvas-audio-bordered" : ""
            } ${selectMode ? "canvas-selecting" : ""} ${
              spacePressed ? "canvas-space-pan" : ""
            }`}
          >
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
                    {messages.canvas.insertNode}
                  </p>
                  {(
                    [
                      ["text", messages.canvas.addText, TextT],
                      ["image", messages.canvas.addImage, ImageSquare],
                      ["video", messages.canvas.addVideo, VideoCamera],
                      ["audio", messages.canvas.addAudio, Waveform],
                      ["group", messages.canvas.addGroup, FolderPlus],
                    ] as const
                  ).map(([type, label, icon]) => (
                    <button
                      key={type}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      onClick={() => {
                        addNodeWithPreset(type, insertMenu.flow);
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
              <CanvasDetailProvider value={canvasDetail}>
              <ReactFlow
                className={
                  viewportZoom < CANVAS_LOD_ZOOM ? "canvas-far" : undefined
                }
                nodes={nodes}
              edges={renderedEdges}
              nodeTypes={canvasNodeTypes}
              edgeTypes={canvasEdgeTypes}
              onNodesChange={handleNodesChange}
              onNodeDragStart={handleNodeDragStart}
              onNodeDrag={handleNodeDrag}
              onNodeDragStop={handleNodeDragStop}
              onEdgesChange={onEdgesChange}
              onNodesDelete={(deleted) => {
                for (const node of deleted) {
                  removeNode(node.id);
                }
              }}
              deleteKeyCode={["Backspace", "Delete"]}
              onConnect={handleConnect as OnConnect}
              isValidConnection={isValidConnection}
              onNodeClick={(_, node) => {
                setInsertMenu(null);
                const isMedia =
                  node.type === "image" || node.type === "video";
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
              fitView
              proOptions={{ hideAttribution: true }}
              // Mount/unmount churn at the viewport edge is worse than just
              // keeping a medium graph mounted: with ~100-300 nodes the
              // pan starts and stops as nodes enter and leave the DOM.
              onlyRenderVisibleElements={nodes.length > 250}
              defaultViewport={CANVAS_DEFAULT_VIEWPORT}
              fitViewOptions={CANVAS_DEFAULT_FIT_VIEW_OPTIONS}
              panOnDrag={
                viewportLocked ? false : selectMode ? [1] : true
              }
              selectionOnDrag={!viewportLocked && selectMode}
              panActivationKeyCode="Space"
              selectionMode={SelectionMode.Partial}
              zoomOnScroll={!viewportLocked}
              zoomOnPinch={!viewportLocked}
              zoomOnDoubleClick={!viewportLocked}
              snapToGrid={preferences.snapToGrid}
              snapGrid={[16, 16]}
              minZoom={CANVAS_MIN_ZOOM}
              maxZoom={CANVAS_MAX_ZOOM}
              colorMode={resolvedTheme === "dark" ? "dark" : "light"}
              connectionRadius={CANVAS_CONNECTION_SNAP_RADIUS}
              connectionLineType={connectionLineType}
              connectionLineStyle={connectionLineStyle}
              defaultEdgeOptions={defaultEdgeOptions}
            >
              <CanvasHelperLinesOverlay lines={helperLines} />
              {highlightedNodeId
                ? (() => {
                    const node = nodes.find(
                      (item) => item.id === highlightedNodeId,
                    );
                    if (!node) {
                      return null;
                    }
                    const parent = node.parentId
                      ? nodes.find((item) => item.id === node.parentId)
                      : undefined;
                    const width = node.width ?? 240;
                    const height = node.height ?? 240;
                    return (
                      <ViewportPortal>
                        <div
                          className="pointer-events-none rounded-xl ring-2 ring-amber-400 transition-opacity"
                          style={{
                            position: "absolute",
                            transform: `translate(${
                              node.position.x + (parent?.position.x ?? 0)
                            }px, ${
                              node.position.y + (parent?.position.y ?? 0)
                            }px)`,
                            width,
                            height,
                            zIndex: 999,
                            boxShadow: "0 0 0 6px rgba(251, 191, 36, 0.18)",
                          }}
                        />
                      </ViewportPortal>
                    );
                  })()
                : null}
              <CanvasBackdrop
                preferences={preferences}
                patternSize={backgroundPatternSize}
                patternColor={backgroundPatternColor}
                nodeCount={nodes.length}
                draggingNode={draggingNode}
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
                runningTaskCount={runningTaskCount}
                selectMode={selectMode}
                selectedNodes={selectedNodes}
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
              </ReactFlow>
              </CanvasDetailProvider>
            </CanvasPreferencesProvider>

            <CanvasSelectionBar
              onCreateGroup={(count) => {
                setGroupName(`${messages.canvas.groupDefault} ${count}`);
                setGroupOpen(true);
              }}
            />

            {!draggingNode ? <CanvasNodeLabels nodes={nodes} /> : null}

            <CanvasNodeDockSlot
              nodeDock={nodeDock}
              onClose={() => setConfigNodeId(null)}
            />
          </div>

          <CanvasGenerationDock
            configNode={configNode ?? null}
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
      <PlaygroundMediaLibraryPicker
        open={assetLibraryOpen}
        onClose={() => setAssetLibraryOpen(false)}
        allowedMediaTypes={["image", "video", "audio"]}
        selectedUrls={librarySelectedUrls}
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
        nodes={nodes}
        edges={edges}
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
        groupSelection={groupSelection}
        selectedNodes={selectedNodes}
      />
    </>
  );
}

export function CanvasEditor({ canvasId }: { canvasId: string }) {
  const { push } = useLocaleRouter();
  const query = usePortalQuery(`portal-canvas-${canvasId}`, () =>
    getCanvas(canvasId),
  );

  if (query.loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
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
