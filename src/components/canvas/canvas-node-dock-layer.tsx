"use client";

import { useStoreApi } from "@xyflow/react";
import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { CANVAS_GENERATION_FLOAT_SURFACE_CLASS } from "@/components/playground/playground-styles";
import { useCanvasStore } from "@/lib/canvas/canvas-store";
import { getNodeById, getNodeIndex } from "@/lib/canvas/canvas-node-index";
import { canvasNodeAbsolutePosition } from "@/lib/canvas/canvas-node-position";

const DOCK_WIDTH = 760;

function dockScreenStyle(
  absolute: { x: number; y: number },
  width: number,
  height: number,
  viewportX: number,
  viewportY: number,
  zoom: number,
): CSSProperties {
  return {
    left: Math.max(
      8,
      viewportX + absolute.x * zoom + (width * zoom - DOCK_WIDTH) / 2,
    ),
    top: viewportY + (absolute.y + height) * zoom + 12,
    width: DOCK_WIDTH,
  };
}

/**
 * Positions the node-anchored generation dock.
 *
 * Subscribes to a single node identity so dragging unrelated nodes does not
 * re-render the dock. Viewport pan/zoom updates `left`/`top` imperatively so
 * the heavy dock tree is not React-reconciled on every transform frame.
 * Ported from the tu_api canvas dock layer.
 */
export function CanvasNodeDockLayer({
  nodeId,
  children,
}: {
  nodeId: string;
  children: ReactNode;
}) {
  const liveNode = useCanvasStore((state) =>
    getNodeById(state.nodes, nodeId),
  );
  const storeApi = useStoreApi();
  const dockElementRef = useRef<HTMLDivElement | null>(null);
  const liveNodeRef = useRef(liveNode);
  liveNodeRef.current = liveNode;

  // Track pan/zoom and live drag positions without a React render. The
  // internal node lookup already carries the display-buffer positions, so the
  // dock stays glued to a node while it is being dragged even though the canvas
  // store is only committed at drag stop.
  useEffect(() => {
    return storeApi.subscribe((state, previous) => {
      if (
        state.transform === previous.transform &&
        state.nodeLookup === previous.nodeLookup
      ) {
        return;
      }
      const element = dockElementRef.current;
      if (!element) {
        return;
      }
      const internal = state.nodeLookup.get(nodeId);
      if (!internal) {
        return;
      }
      const [viewportX, viewportY, zoom] = state.transform;
      const width =
        internal.width ?? internal.measured?.width ?? 280;
      const height =
        internal.height ?? internal.measured?.height ?? 200;
      const next = dockScreenStyle(
        internal.internals.positionAbsolute,
        width,
        height,
        viewportX,
        viewportY,
        zoom,
      );
      element.style.left = `${next.left}px`;
      element.style.top = `${next.top}px`;
      element.style.width = `${next.width}px`;
    });
  }, [nodeId, storeApi]);

  if (!liveNode) {
    return null;
  }

  const transform = storeApi.getState().transform;
  const byId = getNodeIndex(useCanvasStore.getState().nodes);
  const absolute = canvasNodeAbsolutePosition(liveNode, byId);
  const width = liveNode.width ?? liveNode.measured?.width ?? 280;
  const height = liveNode.height ?? liveNode.measured?.height ?? 200;
  const style = dockScreenStyle(
    absolute,
    width,
    height,
    transform[0],
    transform[1],
    transform[2],
  );

  return (
    <div
      ref={dockElementRef}
      className={`canvas-node-dock nodrag absolute z-40 max-h-[55vh] w-[min(760px,calc(100vw-2rem))] overflow-y-auto p-3 ${CANVAS_GENERATION_FLOAT_SURFACE_CLASS}`}
      style={style}
    >
      {children}
    </div>
  );
}
