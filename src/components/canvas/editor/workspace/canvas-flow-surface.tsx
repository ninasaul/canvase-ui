"use client";

import {
  ConnectionLineType,
  ReactFlow,
  SelectionMode,
  ViewportPortal,
  applyNodeChanges,
  useReactFlow,
  useStoreApi,
  type Connection,
  type Edge,
  type IsValidConnection,
  type NodeChange,
  type NodePositionChange,
  type OnConnect,
  type OnNodeDrag,
  type FinalConnectionState,
  type Viewport,
} from "@xyflow/react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { canvasEdgeTypes } from "@/components/canvas/canvas-edge";
import { CanvasNodeLabels } from "@/components/canvas/canvas-node-labels";
import {
  canvasNodeTypes,
  canvasSyntheticNodeTypes,
} from "@/components/canvas/canvas-node-types";

const canvasNodeTypesWithSelection = {
  ...canvasNodeTypes,
  ...canvasSyntheticNodeTypes,
};
import { toast } from "@/components/ui/toast";
import type { CanvasPreferences } from "@/lib/canvas/canvas-preferences";
import {
  canvasEdgeDashArray,
  CANVAS_EDGE_COLORS,
} from "@/lib/canvas/canvas-preferences";
import {
  CANVAS_CONNECTION_SNAP_RADIUS,
  CANVAS_DEFAULT_FIT_VIEW_OPTIONS,
  CANVAS_DEFAULT_VIEWPORT,
  CANVAS_DEFAULT_ZOOM,
  CANVAS_MAX_ZOOM,
  CANVAS_MIN_ZOOM,
  CANVAS_SNAP_DISTANCE,
} from "../lib/constants";
import {
  useCanvasStore,
  type CanvasFlowEdge,
  type CanvasFlowNode,
} from "@/lib/canvas/canvas-store";
import { getNodeById, getNodeIndex } from "@/lib/canvas/canvas-node-index";
import { getChildrenOf } from "@/lib/canvas/canvas-derived";
import { getNodeWithParent } from "@/lib/canvas/canvas-derived";
import { reconcileCanvasDisplayNodes } from "@/lib/canvas/canvas-display-nodes";
import { useCanvasInteractionStore } from "@/lib/canvas/canvas-interaction-store";
import { useCanvasTransientStore } from "@/lib/canvas/canvas-transient-store";
import { syncCanvasEdgeSelection } from "@/lib/canvas/canvas-edge-highlight-store";
import { useCanvasHelperLinesStore } from "@/lib/canvas/canvas-helper-lines-store";
import { shouldAnimateCanvasEdges } from "@/lib/canvas/canvas-viewport-perf";
import { getHelperLines } from "@/lib/canvas/canvas-helper-lines";
import { edgeRoleOptions } from "@/lib/canvas/canvas-edge-roles";
import {
  connectDropCandidateTypes,
  shouldOpenConnectDropMenu,
  type CanvasConnectDropFrom,
} from "@/lib/canvas/canvas-connect-drop";
import { CanvasConnectionLine } from "@/components/canvas/canvas-connection-line";
import {
  SELECTION_BOUNDS_NODE_ID,
  SELECTION_BOUNDS_NODE_TYPE,
  collectSelectionSourceIds,
  computeSelectionBounds,
  expandSelectionBoundsConnection,
  isSelectionBoundsNodeId,
  selectionBoundsAllowsConnection,
} from "@/lib/canvas/canvas-selection-bounds";
import { isCanvasConnectionValid } from "../lib/geometry";
import { messages } from "@/messages";

/** Zoom floor for the "node cloud" framing used when a canvas has outliers. */
const CANVAS_READABLE_ZOOM = 0.2;
/** Detail is swapped for blocks below this zoom (hysteresis: exit at 0.26). */
const CANVAS_LOD_ZOOM = 0.2;
const CANVAS_LOD_EXIT_ZOOM = 0.26;
/**
 * If fitting the whole graph needs less than this share of the zoom that frames
 * the node cloud, the graph is dominated by a few far-away nodes: frame the
 * cloud instead of fitting everything.
 */
const CANVAS_OUTLIER_RATIO = 0.5;

type NodeCloudFrame = {
  centerX: number;
  centerY: number;
  /** Zoom that fits the entire graph, outliers included. */
  wholeZoom: number;
  /** Zoom that frames the 10–90 percentile span around the median node. */
  framedZoom: number;
};

/**
 * Where to land on first paint.
 *
 * A couple of stray nodes tens of thousands of pixels away must not decide the
 * initial view: a plain `fitView` then clamps to the minimum zoom and every
 * node becomes a 5px block (the canvas looks empty). So the camera is aimed at
 * the **median** node and framed on the 10–90 percentile span, which follows
 * the bulk of the graph.
 */
function frameNodeCloud(
  nodes: readonly CanvasFlowNode[],
  width: number,
  height: number,
): NodeCloudFrame {
  const xs: number[] = [];
  const ys: number[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const w = node.width ?? node.measured?.width ?? 240;
    const h = node.height ?? node.measured?.height ?? 200;
    xs.push(node.position.x + w / 2);
    ys.push(node.position.y + h / 2);
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + w);
    maxY = Math.max(maxY, node.position.y + h);
  }
  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  const at = (sorted: number[], p: number) =>
    sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))]!;
  const centerX = at(xs, 0.5);
  const centerY = at(ys, 0.5);
  const spanX = Math.max(at(xs, 0.9) - at(xs, 0.1), 1) + 480;
  const spanY = Math.max(at(ys, 0.9) - at(ys, 0.1), 1) + 480;
  const wholeZoom = Math.min(
    width / Math.max(maxX - minX, 1),
    height / Math.max(maxY - minY, 1),
  );
  return {
    centerX,
    centerY,
    wholeZoom: wholeZoom * 0.9,
    framedZoom: Math.min(width / spanX, height / spanY) * 0.9,
  };
}

export type CanvasFlowSurfaceProps = {
  preferences: CanvasPreferences;
  colorMode: "light" | "dark";
  panOnDrag: boolean | number[];
  selectionOnDrag: boolean;
  zoomEnabled: boolean;
  showHelperLines: boolean;
  onNodeClick: (event: React.MouseEvent, node: CanvasFlowNode) => void;
  onPaneClick: () => void;
  onPaneContextMenu: (event: React.MouseEvent | MouseEvent) => void;
  onMoveEnd: (event: MouseEvent | TouchEvent | null, viewport: Viewport) => void;
  /**
   * A handle drag ended on empty canvas: insert a node there and connect it.
   * Mirrors the reference canvas: the node menu opens at the pointer with only
   * the types that may legally sit on the other end of the new edge.
   */
  onConnectDrop: (drop: {
    clientX: number;
    clientY: number;
    connectFrom: CanvasConnectDropFrom;
  }) => void;
  onDragStart: () => void;
  highlightedNodeId: string | null;
  children: ReactNode;
};

/**
 * The React Flow surface.
 *
 * Two invariants keep a drag gesture cheap (ported from the tu_api graph):
 *
 * 1. The graph renders from a local display buffer. `applyNodeChanges` is
 *    applied there on every pointer move and the canvas store is *not* written
 *    until the gesture ends — one store write per drag instead of one per
 *    frame. The store syncs back through `reconcileCanvasDisplayNodes`, which
 *    preserves node identities so React bails out for untouched nodes.
 * 2. Per-frame work (alignment guides, group hover, snap candidate) is
 *    rAF-throttled and reads the display buffer, never the store.
 */
function CanvasFlowSurfaceInner({
  preferences,
  colorMode,
  panOnDrag,
  selectionOnDrag,
  zoomEnabled,
  showHelperLines,
  onNodeClick,
  onPaneClick,
  onPaneContextMenu,
  onMoveEnd,
  onConnectDrop,
  onDragStart,
  highlightedNodeId,
  children,
}: CanvasFlowSurfaceProps) {
  const edges = useCanvasStore((state) => state.edges);
  const storeOnNodesChange = useCanvasStore((state) => state.onNodesChange);
  const onEdgesChange = useCanvasStore((state) => state.onEdgesChange);
  const onConnect = useCanvasStore((state) => state.onConnect);
  const setNodes = useCanvasStore((state) => state.setNodes);
  const addNodesToGroup = useCanvasStore((state) => state.addNodesToGroup);
  const removeNode = useCanvasStore((state) => state.removeNode);
  const setDragOverGroupId = useCanvasTransientStore(
    (state) => state.setDragOverGroupId,
  );
  const setSnapTargetId = useCanvasTransientStore(
    (state) => state.setSnapTargetId,
  );
  const setHelperLines = useCanvasHelperLinesStore((state) => state.setLines);
  const setDraggingNode = useCanvasInteractionStore(
    (state) => state.setDraggingNode,
  );
  const setDraggingNodeIds = useCanvasInteractionStore(
    (state) => state.setDraggingNodeIds,
  );
  const setDragAffectedNodeIds = useCanvasInteractionStore(
    (state) => state.setDragAffectedNodeIds,
  );
  const storeApi = useStoreApi();
  const { fitView, setCenter, setViewport } = useReactFlow();

  const [displayNodes, setDisplayNodes] = useState<CanvasFlowNode[]>(
    () => useCanvasStore.getState().nodes,
  );
  const displayNodesRef = useRef(displayNodes);
  displayNodesRef.current = displayNodes;

  const draggingRef = useRef(false);
  const dragFrameRef = useRef<number | null>(null);
  const dragNodeRef = useRef<CanvasFlowNode | null>(null);
  /** Handle a connection drag started from (for multi-select fan-out). */
  const connectStartRef = useRef<{
    nodeId: string;
    handleId: string | null;
    handleType: "source" | "target";
  } | null>(null);
  const initialFitDoneRef = useRef(false);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const showHelperLinesRef = useRef(showHelperLines);
  showHelperLinesRef.current = showHelperLines;

  // ---- detail level: one CSS switch, no React render ---------------------
  // Exactly one level-of-detail level, like the reference implementation:
  // below CANVAS_LOD_ZOOM the node content is illegible anyway, so the detail
  // layer is swapped for the cheap block. A second "labels disappear at 50%"
  // tier used to pop every label out mid-gesture — that pop *was* the zoom
  // flash — so labels and edge chips now follow the same single switch.
  //
  // The class is toggled imperatively from the viewport subscription with
  // hysteresis, so crossing the threshold costs one `classList.toggle` and
  // never re-renders the graph.
  useEffect(() => {
    const element = surfaceRef.current;
    if (!element) {
      return;
    }
    let far = element.classList.contains("canvas-far");
    const apply = (zoom: number) => {
      const nextFar = far ? zoom < CANVAS_LOD_EXIT_ZOOM : zoom < CANVAS_LOD_ZOOM;
      if (nextFar !== far) {
        far = nextFar;
        element.classList.toggle("canvas-far", far);
      }
    };
    apply(storeApi.getState().transform[2]);
    return storeApi.subscribe((state, previous) => {
      if (state.transform[2] !== previous.transform[2]) {
        apply(state.transform[2]);
      }
    });
  }, [storeApi]);

  // ---- selection → edge layer -------------------------------------------
  // Edges light up when either endpoint is selected. Publishing a Set once per
  // selection change keeps ~200 edge subscriptions off the graph write path.
  useEffect(() => {
    syncCanvasEdgeSelection(useCanvasStore.getState().nodes);
    return useCanvasStore.subscribe((state, previous) => {
      if (state.nodes === previous.nodes) {
        return;
      }
      syncCanvasEdgeSelection(state.nodes);
    });
  }, []);

  // ---- store → display buffer -------------------------------------------
  useEffect(() => {
    return useCanvasStore.subscribe((state, previous) => {
      if (state.nodes === previous.nodes) {
        return;
      }
      // While a gesture is running the display buffer is authoritative; the
      // store is committed once on drag stop.
      if (draggingRef.current) {
        return;
      }
      setDisplayNodes((current) => {
        const next = reconcileCanvasDisplayNodes(current, state.nodes);
        displayNodesRef.current = next;
        return next;
      });
    });
  }, []);

  // ---- fit the view once per canvas, never per nodes change --------------
  // Passing the boolean `fitView` prop re-queues a fit whenever the nodes array
  // changes, which re-centres the viewport mid-drag.
  useEffect(() => {
    initialFitDoneRef.current = false;
  }, []);
  // Fit once per mount, but only after the pane has a size and nodes exist:
  // `useNodesInitialized` is already true at mount because our nodes carry
  // explicit width/height, so fitting from it ran while React Flow still
  // reported width/height 0 — a no-op that left the graph at the default
  // viewport (nodes parked off-screen, edges apparently "missing").
  //
  // A plain `fitView` breaks on canvases with a few outlier nodes (one node
  // 48 000px away clamps the fit to the minimum zoom, where every node is a
  // 5px block — the canvas looks empty). So the first view is framed around the
  // node cloud minus its outliers, with a readable zoom floor.
  useEffect(() => {
    if (initialFitDoneRef.current) {
      return;
    }
    let frames = 0;
    let raf = 0;
    const attempt = () => {
      const { width, height } = storeApi.getState();
      const nodes = displayNodesRef.current;
      if (width > 0 && height > 0 && nodes.length > 0) {
        initialFitDoneRef.current = true;
        const frame = frameNodeCloud(nodes, width, height);
        const compactEnough =
          frame.wholeZoom / Math.max(frame.framedZoom, 1e-6) >=
          CANVAS_OUTLIER_RATIO;
        if (compactEnough) {
          // The graph fits as a whole: frame it completely.
          void fitView(CANVAS_DEFAULT_FIT_VIEW_OPTIONS);
        } else {
          // A few stray nodes make a full fit unreadable — land on the cloud.
          setCenter(frame.centerX, frame.centerY, {
            zoom: Math.min(
              Math.max(frame.framedZoom, CANVAS_READABLE_ZOOM),
              CANVAS_DEFAULT_ZOOM,
            ),
          });
        }
        return;
      }
      if (frames++ < 60) {
        raf = window.requestAnimationFrame(attempt);
      }
    };
    raf = window.requestAnimationFrame(attempt);
    return () => window.cancelAnimationFrame(raf);
  }, [fitView, setCenter, storeApi]);

  // ---- connection validity ----------------------------------------------
  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      const state = useCanvasStore.getState();
      // The multi-selection box is synthetic: it is valid when at least one of
      // the selected nodes may connect to the target.
      if (isSelectionBoundsNodeId(connection.source)) {
        return selectionBoundsAllowsConnection({
          connection,
          nodes: state.nodes,
          edges: state.edges,
        });
      }
      return isCanvasConnectionValid(connection, state.nodes, state.edges);
    },
    [],
  );

  /** Multi-select: dragging from one selected source wires the others too. */
  /**
   * Nodes handed to React Flow: the display buffer plus a synthetic box when
   * two or more nodes are selected. The box carries one connection point on its
   * right edge (`selectionBounds` type), so a whole selection can be wired at
   * once without touching the document.
   */
  const flowNodes = useMemo(() => {
    const bounds = computeSelectionBounds(displayNodes);
    if (!bounds) {
      return displayNodes;
    }
    const selectionNode = {
      id: SELECTION_BOUNDS_NODE_ID,
      type: SELECTION_BOUNDS_NODE_TYPE,
      position: { x: bounds.x, y: bounds.y },
      width: bounds.width,
      height: bounds.height,
      data: { count: bounds.count },
      selected: false,
      selectable: false,
      draggable: false,
      deletable: false,
      focusable: false,
      connectable: true,
      style: { zIndex: 5, width: bounds.width, height: bounds.height },
    };
    return [...displayNodes, selectionNode as unknown as CanvasFlowNode];
  }, [displayNodes]);

  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      if (!shouldOpenConnectDropMenu(connectionState)) {
        return;
      }
      const nodeId = connectionState.fromNode.id;
      const storeNodes = useCanvasStore.getState().nodes;
      const originTypes = isSelectionBoundsNodeId(nodeId)
        ? collectSelectionSourceIds(storeNodes).flatMap((id) => {
            const node = getNodeById(storeNodes, id);
            return node ? [node.type] : [];
          })
        : (() => {
            const origin = getNodeById(storeNodes, nodeId);
            return origin ? [origin.type] : [];
          })();
      const allowedTypes = connectDropCandidateTypes({
        handleType: connectionState.fromHandle.type,
        handleId: connectionState.fromHandle.id ?? null,
        originTypes,
      });
      if (allowedTypes.length === 0) {
        return;
      }
      const clientX =
        "changedTouches" in event
          ? (event.changedTouches[0]?.clientX ?? null)
          : event.clientX;
      const clientY =
        "changedTouches" in event
          ? (event.changedTouches[0]?.clientY ?? null)
          : event.clientY;
      if (clientX == null || clientY == null) {
        return;
      }
      onConnectDrop({
        clientX,
        clientY,
        connectFrom: {
          nodeId,
          handleId: connectionState.fromHandle.id ?? null,
          handleType: connectionState.fromHandle.type,
          allowedTypes,
        },
      });
    },
    [onConnectDrop],
  );

  /**
   * Multi-select fan-out: dragging from a handle while several nodes are
   * selected connects **every** selected node to the other end, in one write.
   *
   * `onConnectStart` tells us which side the drag began on, so it works in both
   * directions: out of an output handle → all selected become sources; out of
   * an input handle → all selected become targets.
   */
  const handleConnect = useCallback(
    (connection: Connection) => {
      const start = connectStartRef.current;
      connectStartRef.current = null;
      if (isSelectionBoundsNodeId(connection.source)) {
        const state = useCanvasStore.getState();
        const expanded = expandSelectionBoundsConnection({
          connection,
          nodes: state.nodes,
          edges: state.edges,
          sourceIds: collectSelectionSourceIds(displayNodesRef.current),
        });
        useCanvasStore.getState().connectMany(expanded);
        if (expanded.length > 0) {
          toast.success(
            messages.canvas.batchConnected.replace(
              "{count}",
              String(expanded.length),
            ),
          );
        }
        return;
      }
      const targetId = connection.target;
      const sourceId = connection.source;
      if (!sourceId || !targetId) {
        onConnect(connection);
        return;
      }
      const state = useCanvasStore.getState();
      const selected = state.nodes.filter(
        (node) =>
          node.selected &&
          node.type !== "group" &&
          node.id !== (start?.handleType === "target" ? sourceId : targetId),
      );
      const draggedSelected =
        start !== null && selected.some((node) => node.id === start.nodeId);
      if (!draggedSelected || selected.length < 2) {
        onConnect(connection);
        return;
      }
      const fanOutSources = start!.handleType === "source";
      const handleId =
        (fanOutSources ? connection.sourceHandle : connection.targetHandle) ??
        (fanOutSources ? "out" : "in");
      const connections: Connection[] = [connection];
      for (const node of selected) {
        if (node.id === start!.nodeId) {
          continue;
        }
        const candidate: Connection = fanOutSources
          ? {
              source: node.id,
              sourceHandle: handleId,
              target: targetId,
              targetHandle: connection.targetHandle ?? "in",
            }
          : {
              source: sourceId,
              sourceHandle: connection.sourceHandle ?? "out",
              target: node.id,
              targetHandle: handleId,
            };
        if (!isCanvasConnectionValid(candidate, state.nodes, state.edges)) {
          continue;
        }
        connections.push(candidate);
      }
      useCanvasStore.getState().connectMany(connections);
      if (connections.length > 1) {
        toast.success(
          messages.canvas.batchConnected.replace(
            "{count}",
            String(connections.length),
          ),
        );
      }
    },
    [onConnect],
  );

  // ---- graph scans used by the drag gesture (read-only, on demand) -------
  const groupAtNode = useCallback((node: CanvasFlowNode) => {
    if (node.type === "group" || node.parentId) {
      return undefined;
    }
    const currentNodes = displayNodesRef.current;
    const width = node.measured?.width ?? node.width ?? 240;
    const height = node.measured?.height ?? node.height ?? 200;
    const centerX = node.position.x + width / 2;
    const centerY = node.position.y + height / 2;
    return [...currentNodes].reverse().find((item) => {
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
  }, []);

  const snapCandidateFor = useCallback(
    (node: CanvasFlowNode) => {
      if (!preferences.autoConnect) {
        return null;
      }
      if (node.type === "group" || node.parentId) {
        return null;
      }
      const currentNodes = displayNodesRef.current;
      const currentEdges = useCanvasStore.getState().edges;
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
      for (const candidate of currentNodes) {
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
          currentEdges.some(
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
    },
    [isValidConnection, preferences.autoConnect],
  );

  /** Guides, group hover and snap target for the current drag frame. */
  const flushDragFrame = useCallback(
    (node: CanvasFlowNode) => {
      const current = displayNodesRef.current;
      if (showHelperLinesRef.current) {
        const change: NodePositionChange = {
          type: "position",
          id: node.id,
          position: { ...node.position },
          dragging: true,
        };
        // 6 screen pixels at any zoom: the previous fixed flow-unit threshold
        // grew into a huge snap zone after zooming in, which is why the
        // shaking was worst right after a zoom.
        const zoom = Math.max(storeApi.getState().transform[2], 0.05);
        const result = getHelperLines(change, current, 6 / zoom);
        setHelperLines({
          horizontal: result.horizontal,
          vertical: result.vertical,
        });
      }
      if (node.parentId) {
        // Children are constrained by `extent: "parent"`; no group/snap scan.
        setDragOverGroupId(null);
        setSnapTargetId(null);
        return;
      }
      // Skip the scans when the graph cannot produce a hit; the setters are
      // equality-guarded so stale highlights still clear.
      const hasGroup = current.some((item) => item.type === "group");
      const canSnap =
        preferences.autoConnect &&
        current.length > 1 &&
        node.type !== "group";
      setDragOverGroupId(hasGroup ? (groupAtNode(node)?.id ?? null) : null);
      setSnapTargetId(canSnap ? (snapCandidateFor(node)?.id ?? null) : null);
    },
    [
      groupAtNode,
      preferences.autoConnect,
      setDragOverGroupId,
      setHelperLines,
      setSnapTargetId,
      snapCandidateFor,
      storeApi,
    ],
  );

  /**
   * Land the viewport on whole device pixels when a gesture ends.
   *
   * Wheel zoom leaves the transform at e.g. `translate(513.196px, …)`; text and
   * 1px strokes then sit between device pixels and the browser resamples the
   * whole layer, which shows up as shimmer. Snapping once per gesture is
   * invisible (<= 1 device pixel) and makes the final raster crisp.
   */
  const handleMoveEnd = useCallback(
    (event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
      onMoveEnd(event, viewport);
      const dpr = window.devicePixelRatio || 1;
      const x = Math.round(viewport.x * dpr) / dpr;
      const y = Math.round(viewport.y * dpr) / dpr;
      if (Math.abs(x - viewport.x) > 0.01 || Math.abs(y - viewport.y) > 0.01) {
        void setViewport({ x, y, zoom: viewport.zoom }, { duration: 0 });
      }
    },
    [onMoveEnd, setViewport],
  );

  // ---- node changes ------------------------------------------------------
  const handleNodesChange = useCallback(
    (changes: NodeChange<CanvasFlowNode>[]) => {
      if (changes.length === 0) {
        return;
      }
      // The selection box is synthetic: never let its changes reach the store.
      const graphChanges = changes.filter((change) =>
        change.type === "add"
          ? !isSelectionBoundsNodeId(change.item.id)
          : !isSelectionBoundsNodeId(change.id),
      );
      if (graphChanges.length === 0) {
        return;
      }
      if (!draggingRef.current) {
        // Selection / dimensions / removal: the store is the source of truth.
        storeOnNodesChange(graphChanges);
        return;
      }
      // Mid-gesture: only the local buffer moves, and it moves exactly where
      // the pointer puts it. Rewriting the position here (guide snapping) made
      // the node stick to a guide and pop free on the next 1px move — shaking
      // whose strength depended on zoom. Guides are display-only now.
      setDisplayNodes((current) => {
        const next = applyNodeChanges(graphChanges, current);
        displayNodesRef.current = next;
        return next;
      });
    },
    [storeOnNodesChange],
  );

  // ---- drag gesture ------------------------------------------------------
  const handleNodeDragStart = useCallback<OnNodeDrag<CanvasFlowNode>>(
    (_event, node, draggedNodes) => {
      draggingRef.current = true;
      const ids =
        draggedNodes && draggedNodes.length > 0
          ? draggedNodes.map((item) => item.id)
          : [node.id];
      setDraggingNodeIds(ids);
      // A dragged group moves its children by the same delta, so the edges of
      // those children move too — they light up with the group's own edges.
      const affected = new Set(ids);
      const storeNodes = useCanvasStore.getState().nodes;
      const queue = [...ids];
      while (queue.length > 0) {
        const id = queue.pop()!;
        for (const child of getChildrenOf(storeNodes, id)) {
          if (affected.has(child.id)) {
            continue;
          }
          affected.add(child.id);
          queue.push(child.id);
        }
      }
      setDragAffectedNodeIds(affected);
      setDraggingNode(true);
      // Labels read the committed store positions, which do not move during a
      // drag; leaving them mounted makes them trail the node and snap into
      // place on drop. Hide the layer for the gesture (CSS only, no unmount).
      surfaceRef.current?.classList.add("canvas-dragging");
      setHelperLines(null);
      setDragOverGroupId(null);
      setSnapTargetId(null);
      onDragStart();
    },
    [
      onDragStart,
      setDragAffectedNodeIds,
      setDragOverGroupId,
      setDraggingNode,
      setDraggingNodeIds,
      setHelperLines,
      setSnapTargetId,
    ],
  );

  const handleNodeDrag = useCallback<OnNodeDrag<CanvasFlowNode>>(
    (_event, node) => {
      dragNodeRef.current = node;
      if (dragFrameRef.current != null) {
        return;
      }
      dragFrameRef.current = window.requestAnimationFrame(() => {
        dragFrameRef.current = null;
        const current = dragNodeRef.current;
        if (!current) {
          return;
        }
        flushDragFrame(
          displayNodesRef.current.find((item) => item.id === current.id) ??
            current,
        );
      });
    },
    [flushDragFrame],
  );

  const handleNodeDragStop = useCallback<OnNodeDrag<CanvasFlowNode>>(
    (_event, node) => {
      if (dragFrameRef.current != null) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
      dragNodeRef.current = null;
      draggingRef.current = false;
      surfaceRef.current?.classList.remove("canvas-dragging");

      // One store write for the whole gesture. Positions come from the display
      // buffer; everything else (prompt/params/status written by a run or the
      // agent while dragging) comes from the store, so nothing is clobbered and
      // nodes added mid-drag survive.
      const displayById = getNodeIndex(displayNodesRef.current);
      const storeNodes = useCanvasStore.getState().nodes;
      let changed = false;
      const next = storeNodes.map((storeNode) => {
        const displayNode = displayById.get(storeNode.id);
        if (!displayNode) {
          return storeNode;
        }
        if (
          displayNode.position.x === storeNode.position.x &&
          displayNode.position.y === storeNode.position.y
        ) {
          return storeNode;
        }
        changed = true;
        return {
          ...storeNode,
          position: { ...displayNode.position },
        };
      });
      if (changed) {
        setNodes(next);
      }

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
    },
    [
      addNodesToGroup,
      groupAtNode,
      onConnect,
      setDragOverGroupId,
      setDraggingNode,
      setHelperLines,
      setNodes,
      setSnapTargetId,
      snapCandidateFor,
    ],
  );

  const handleNodesDelete = useCallback(
    (deleted: CanvasFlowNode[]) => {
      for (const node of deleted) {
        removeNode(node.id);
      }
    },
    [removeNode],
  );

  useEffect(() => {
    return () => {
      if (dragFrameRef.current != null) {
        window.cancelAnimationFrame(dragFrameRef.current);
      }
    };
  }, []);

  // ---- edges -------------------------------------------------------------
  const draggingNode = useCanvasInteractionStore((state) => state.draggingNode);
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
      // Same reason as the edge paths: keep the preview line a constant screen
      // width while zooming.
      vectorEffect: "non-scaling-stroke" as const,
      ...(edgeDash ? { strokeDasharray: edgeDash } : {}),
    }),
    [edgeDash, edgeStroke, preferences.edgeWidth],
  );
  const edgesAnimated = useMemo(
    () =>
      !draggingNode &&
      shouldAnimateCanvasEdges(preferences.animateEdges, edges.length),
    [draggingNode, edges.length, preferences.animateEdges],
  );
  const defaultEdgeOptions = useMemo(
    () => ({
      type: "canvas" as const,
      animated: edgesAnimated,
      style: connectionLineStyle,
    }),
    [edgesAnimated, connectionLineStyle],
  );
  const renderedEdges = useMemo(
    () => edges.map((edge) => ({ ...edge, animated: edgesAnimated })),
    [edges, edgesAnimated],
  );

  return (
    <div ref={surfaceRef} className="relative h-full w-full">
    <ReactFlow

      nodes={flowNodes}
      edges={renderedEdges}
      nodeTypes={canvasNodeTypesWithSelection}
      edgeTypes={canvasEdgeTypes}
      onNodesChange={handleNodesChange}
      onNodeDragStart={handleNodeDragStart}
      onNodeDrag={handleNodeDrag}
      onNodeDragStop={handleNodeDragStop}
      onEdgesChange={onEdgesChange}
      onNodesDelete={handleNodesDelete}
      deleteKeyCode={["Backspace", "Delete"]}
      onConnect={handleConnect as OnConnect}
      onConnectStart={(_, params) => {
        connectStartRef.current =
          params.nodeId && params.handleType
            ? {
                nodeId: params.nodeId,
                handleId: params.handleId ?? null,
                handleType: params.handleType,
              }
            : null;
      }}
      isValidConnection={isValidConnection as IsValidConnection<CanvasFlowEdge>}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      onPaneContextMenu={onPaneContextMenu}
      onMoveEnd={handleMoveEnd}
      proOptions={{ hideAttribution: true }}
      // No `onlyRenderVisibleElements` and no gesture subscriptions here:
      // both made the surface re-render at gesture start/end, and every
      // ReactFlow re-render makes xyflow rebuild its internal nodes — which
      // re-rendered *every* NodeWrapper and EdgeWrapper (measured in dev with
      // 200 nodes: 800 NodeWrapper + 800 NodeShell + 640 CanvasEdge renders
      // for a single pan). The surface now renders only when the graph or the
      // detail level actually changes, so pan/zoom is React-free.
      //
      // Off-screen nodes stay mounted; the far-zoom CSS level-of-detail keeps
      // them as plain blocks and the graph is capped at 200 nodes.
      defaultViewport={CANVAS_DEFAULT_VIEWPORT}
      panOnDrag={panOnDrag}
      selectionOnDrag={selectionOnDrag}
      panActivationKeyCode="Space"
      selectionMode={SelectionMode.Partial}
      zoomOnScroll={zoomEnabled}
      zoomOnPinch={zoomEnabled}
      zoomOnDoubleClick={zoomEnabled}
      snapToGrid={preferences.snapToGrid}
      snapGrid={[16, 16]}
      minZoom={CANVAS_MIN_ZOOM}
      maxZoom={CANVAS_MAX_ZOOM}
      colorMode={colorMode}
      connectionRadius={CANVAS_CONNECTION_SNAP_RADIUS}
      connectionLineType={connectionLineType}
      connectionLineStyle={connectionLineStyle}
      connectionLineComponent={CanvasConnectionLine}
      onConnectEnd={handleConnectEnd}
      defaultEdgeOptions={defaultEdgeOptions}
    >
      {children}
      <CanvasNodeLabels />
      {highlightedNodeId ? (
        <CanvasAgentHighlight nodeId={highlightedNodeId} />
      ) : null}
    </ReactFlow>
    </div>
  );
}

/**
 * Ring drawn around the node an agent is touching. Subscribes to its own node
 * so the highlight never re-renders the surface.
 */
function CanvasAgentHighlight({ nodeId }: { nodeId: string }) {
  const anchor = useCanvasStore((state) => {
    const { node, parent } = getNodeWithParent(state.nodes, nodeId);
    if (!node) {
      return null;
    }
    return {
      x: node.position.x + (parent?.position.x ?? 0),
      y: node.position.y + (parent?.position.y ?? 0),
      width: node.width ?? 240,
      height: node.height ?? 240,
    };
  });
  if (!anchor) {
    return null;
  }
  return (
    <ViewportPortal>
      <div
        className="pointer-events-none rounded-xl ring-2 ring-amber-400 transition-opacity"
        style={{
          position: "absolute",
          transform: `translate(${anchor.x}px, ${anchor.y}px)`,
          width: anchor.width,
          height: anchor.height,
          zIndex: 999,
          boxShadow: "0 0 0 6px rgba(251, 191, 36, 0.18)",
        }}
      />
    </ViewportPortal>
  );
}

export const CanvasFlowSurface = memo(CanvasFlowSurfaceInner);
