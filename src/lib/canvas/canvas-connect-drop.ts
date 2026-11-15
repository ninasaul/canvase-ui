import type { Connection, FinalConnectionState } from "@xyflow/react";

import { edgeRoleOptions } from "./canvas-edge-roles";
import type { CanvasNodeType } from "./canvas-graph";

export type CanvasConnectableNodeType = Exclude<CanvasNodeType, "group">;

export const CANVAS_CONNECTABLE_NODE_TYPES: readonly CanvasConnectableNodeType[] =
  ["text", "image", "video", "audio"];

export type CanvasConnectDropFrom = {
  nodeId: string;
  handleId: string | null;
  handleType: "source" | "target";
  /** Node types that may become the other end of the new edge. */
  allowedTypes: CanvasConnectableNodeType[];
};

/** Input handle id for a newly created target node. */
export function canvasNodeTargetHandleId(
  type: CanvasConnectableNodeType,
): string {
  return type === "text" ? "context" : "in";
}

function isConnectableType(
  type: CanvasNodeType | undefined,
): type is CanvasConnectableNodeType {
  return (
    type === "text" ||
    type === "image" ||
    type === "video" ||
    type === "audio"
  );
}

/**
 * Types that can be created after a handle drag ended on empty canvas, based on
 * the edge rules:
 * - from a source handle: candidates become the new **target**;
 * - from a target handle: candidates become the new **source**.
 *
 * Ported from the reference canvas (`tu_api`) connect-drop helper.
 */
export function connectDropCandidateTypes(input: {
  handleType: "source" | "target";
  handleId: string | null;
  /** Types acting as the drag origin side. */
  originTypes: readonly CanvasNodeType[];
}): CanvasConnectableNodeType[] {
  const originTypes = input.originTypes.filter(isConnectableType);
  if (originTypes.length === 0) {
    return [];
  }

  return CANVAS_CONNECTABLE_NODE_TYPES.filter((candidate) => {
    if (input.handleType === "source") {
      return originTypes.some(
        (sourceType) =>
          edgeRoleOptions(sourceType, candidate).length > 0,
      );
    }
    return originTypes.some(
      (targetType) =>
        edgeRoleOptions(candidate, targetType).length > 0 &&
        (input.handleId ?? "in").length > 0,
    );
  });
}

/** Connection to create between a dragged handle and a freshly inserted node. */
export function connectionFromConnectDrop(input: {
  newNodeId: string;
  newNodeType: CanvasConnectableNodeType;
  connectFrom: Pick<
    CanvasConnectDropFrom,
    "nodeId" | "handleId" | "handleType"
  >;
}): Connection {
  const { newNodeId, newNodeType, connectFrom } = input;
  if (connectFrom.handleType === "source") {
    return {
      source: connectFrom.nodeId,
      sourceHandle: connectFrom.handleId ?? "out",
      target: newNodeId,
      targetHandle: canvasNodeTargetHandleId(newNodeType),
    };
  }
  return {
    source: newNodeId,
    sourceHandle: "out",
    target: connectFrom.nodeId,
    targetHandle: connectFrom.handleId ?? "in",
  };
}

/** True when a handle drag ended on empty canvas (not a valid target). */
export function shouldOpenConnectDropMenu(
  connectionState: FinalConnectionState,
): connectionState is FinalConnectionState & {
  fromNode: { id: string };
  fromHandle: { id: string | null; type: "source" | "target" };
} {
  if (!("fromNode" in connectionState) || !connectionState.fromNode) {
    return false;
  }
  if (!connectionState.fromHandle) {
    return false;
  }
  if (connectionState.isValid) {
    return false;
  }
  if (connectionState.toNode) {
    return false;
  }
  return true;
}
