"use client";

import { Panel, useReactFlow, useStoreApi } from "@xyflow/react";
import { useEffect, useMemo, useRef } from "react";

import { useShallow } from "zustand/react/shallow";
import { useCanvasStore, type CanvasFlowNode } from "@/lib/canvas/canvas-store";
import { getNodeIndex } from "@/lib/canvas/canvas-node-index";
import { canvasNodeAbsolutePosition } from "@/lib/canvas/canvas-node-position";
import { NODE_TYPE_COLORS } from "../lib/constants";

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 150;
const PADDING = 24;

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  nodes: CanvasFlowNode[];
};

const EMPTY_BOUNDS: Bounds = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  nodes: [],
};

/** Graph bounds in flow coordinates, recomputed only when nodes change. */
function measureBounds(nodes: readonly CanvasFlowNode[]): Bounds {
  if (nodes.length === 0) {
    return EMPTY_BOUNDS;
  }
  const byId = getNodeIndex(nodes);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const position = canvasNodeAbsolutePosition(node, byId);
    const width = node.width ?? node.measured?.width ?? 240;
    const height = node.height ?? node.measured?.height ?? 200;
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    maxX = Math.max(maxX, position.x + width);
    maxY = Math.max(maxY, position.y + height);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return EMPTY_BOUNDS;
  }
  return {
    x: minX - PADDING,
    y: minY - PADDING,
    width: Math.max(1, maxX - minX + PADDING * 2),
    height: Math.max(1, maxY - minY + PADDING * 2),
    nodes: nodes as CanvasFlowNode[],
  };
}

/**
 * Static overview of the graph with a live viewport outline.
 *
 * xyflow's `<MiniMap>` subscribes to the viewport in React and re-renders every
 * node rectangle on each pan frame (measured: one React commit per frame with
 * 120 `rect`s). Here the node rects are computed from the canvas store (so only
 * a real graph change re-renders) and the viewport outline is updated by
 * writing SVG attributes from a store subscription.
 */
export function CanvasMinimap() {
  const storeApi = useStoreApi();
  const { setCenter } = useReactFlow();
  const bounds = useCanvasStore(useShallow((state) => measureBounds(state.nodes)));
  const viewportRef = useRef<SVGRectElement | null>(null);

  const view = useMemo(() => {
    const scale = Math.min(
      MINIMAP_WIDTH / bounds.width,
      MINIMAP_HEIGHT / bounds.height,
    );
    const offsetX = (MINIMAP_WIDTH - bounds.width * scale) / 2;
    const offsetY = (MINIMAP_HEIGHT - bounds.height * scale) / 2;
    return {
      scale,
      toMiniX: (x: number) => offsetX + (x - bounds.x) * scale,
      toMiniY: (y: number) => offsetY + (y - bounds.y) * scale,
      toFlowX: (x: number) => (x - offsetX) / scale + bounds.x,
      toFlowY: (y: number) => (y - offsetY) / scale + bounds.y,
    };
  }, [bounds]);

  useEffect(() => {
    const outline = viewportRef.current;
    if (!outline) {
      return;
    }
    const apply = (transform: readonly [number, number, number], width: number, height: number) => {
      const [x, y, zoom] = transform;
      const flowX = -x / zoom;
      const flowY = -y / zoom;
      const flowW = width / zoom;
      const flowH = height / zoom;
      outline.setAttribute("x", String(view.toMiniX(flowX)));
      outline.setAttribute("y", String(view.toMiniY(flowY)));
      outline.setAttribute("width", String(Math.max(flowW * view.scale, 2)));
      outline.setAttribute("height", String(Math.max(flowH * view.scale, 2)));
    };
    const initial = storeApi.getState();
    apply(initial.transform, initial.width, initial.height);
    return storeApi.subscribe((state, previous) => {
      if (
        state.transform === previous.transform &&
        state.width === previous.width &&
        state.height === previous.height
      ) {
        return;
      }
      apply(state.transform, state.width, state.height);
    });
  }, [storeApi, view]);

  const nodeRects = useMemo(() => {
    const byId = getNodeIndex(bounds.nodes);
    return bounds.nodes.map((node) => {
      const position = canvasNodeAbsolutePosition(node, byId);
      const width = node.width ?? node.measured?.width ?? 240;
      const height = node.height ?? node.measured?.height ?? 200;
      return {
        id: node.id,
        x: view.toMiniX(position.x),
        y: view.toMiniY(position.y),
        width: Math.max(width * view.scale, 1.5),
        height: Math.max(height * view.scale, 1.5),
        fill: NODE_TYPE_COLORS[node.type ?? "text"] ?? "#a1a1aa",
        group: node.type === "group",
      };
    });
  }, [bounds.nodes, view]);

  return (
    <Panel
      position="bottom-right"
      className="!m-3 overflow-hidden rounded-md border border-zinc-200/80 bg-white/90 shadow-sm backdrop-blur dark:border-zinc-700/70 dark:bg-zinc-900/90"
    >
      <svg
        className="canvas-minimap block cursor-crosshair"
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        role="img"
        aria-label="Minimap"
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setCenter(
            view.toFlowX(event.clientX - rect.left),
            view.toFlowY(event.clientY - rect.top),
            { zoom: storeApi.getState().transform[2] },
          );
        }}
      >
        {nodeRects.map((node) => (
          <rect
            key={node.id}
            x={node.x}
            y={node.y}
            width={node.width}
            height={node.height}
            rx={2}
            fill={node.fill}
            fillOpacity={node.group ? 0.15 : 0.75}
            stroke={node.group ? node.fill : "none"}
            strokeWidth={node.group ? 1 : 0}
          />
        ))}
        <rect
          ref={viewportRef}
          x={0}
          y={0}
          width={0}
          height={0}
          fill="rgba(56,189,248,0.12)"
          stroke="#38bdf8"
          strokeWidth={1.25}
          pointerEvents="none"
        />
      </svg>
    </Panel>
  );
}
