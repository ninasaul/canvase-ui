import type { Node, NodePositionChange, XYPosition } from "@xyflow/react";

export type CanvasHelperLines = {
  horizontal?: number;
  vertical?: number;
};

export type CanvasHelperLinesResult = CanvasHelperLines;

type NodeBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

const DEFAULT_DISTANCE = 6;

function nodeSize(node: Node): { width: number; height: number } {
  const width =
    node.measured?.width ??
    (typeof node.width === "number" ? node.width : undefined) ??
    (typeof node.style?.width === "number" ? node.style.width : undefined) ??
    0;
  const height =
    node.measured?.height ??
    (typeof node.height === "number" ? node.height : undefined) ??
    (typeof node.style?.height === "number" ? node.style.height : undefined) ??
    0;
  return { width, height };
}

function boundsForPosition(node: Node, position: XYPosition): NodeBounds {
  const { width, height } = nodeSize(node);
  return {
    left: position.x,
    right: position.x + width,
    top: position.y,
    bottom: position.y + height,
    width,
    height,
  };
}

/**
 * Closest horizontal / vertical alignments while dragging a node.
 * Mutates snap targets so edges or centers line up within `distance`.
 */
/**
 * Alignment guides for a dragged node. **Display-only**: the guides are shown
 * while the node is dragged over another node's edge/centre, but the position
 * is never rewritten. Snapping here fought the pointer (the node stuck to a
 * guide and popped free again on the next 1px move) and the strength of that
 * fight depended on zoom, which read as shaking — worst right after zooming.
 * `distance` is in flow units; pass `6 / zoom` for a constant screen distance.
 */
export function getHelperLines(
  change: NodePositionChange,
  nodes: Node[],
  distance = DEFAULT_DISTANCE,
): CanvasHelperLinesResult {
  const empty: CanvasHelperLinesResult = {};
  if (!change.position) {
    return empty;
  }

  const moving = nodes.find((node) => node.id === change.id);
  if (!moving) {
    return empty;
  }

  const movingBounds = boundsForPosition(moving, change.position);
  if (movingBounds.width <= 0 || movingBounds.height <= 0) {
    return empty;
  }

  let horizontalDistance = distance;
  let verticalDistance = distance;
  let horizontal: number | undefined;
  let vertical: number | undefined;

  for (const node of nodes) {
    if (node.id === moving.id || node.parentId !== moving.parentId) {
      continue;
    }
    const { width, height } = nodeSize(node);
    if (width <= 0 || height <= 0) {
      continue;
    }
    const other: NodeBounds = {
      left: node.position.x,
      right: node.position.x + width,
      top: node.position.y,
      bottom: node.position.y + height,
      width,
      height,
    };

    const comparisons = [
      {
        distance: Math.abs(movingBounds.left - other.left),
        line: other.left,
      },
      {
        distance: Math.abs(movingBounds.right - other.right),
        line: other.right,
      },
      {
        distance: Math.abs(movingBounds.left - other.right),
        line: other.right,
      },
      {
        distance: Math.abs(movingBounds.right - other.left),
        line: other.left,
      },
      {
        distance: Math.abs(
          movingBounds.left + movingBounds.width / 2 - (other.left + other.width / 2),
        ),
        line: other.left + other.width / 2,
      },
    ];

    for (const item of comparisons) {
      if (item.distance < verticalDistance) {
        verticalDistance = item.distance;
        vertical = item.line;
      }
    }

    const verticalComparisons = [
      {
        distance: Math.abs(movingBounds.top - other.top),
        line: other.top,
      },
      {
        distance: Math.abs(movingBounds.bottom - other.bottom),
        line: other.bottom,
      },
      {
        distance: Math.abs(movingBounds.top - other.bottom),
        line: other.bottom,
      },
      {
        distance: Math.abs(movingBounds.bottom - other.top),
        line: other.top,
      },
      {
        distance: Math.abs(
          movingBounds.top + movingBounds.height / 2 - (other.top + other.height / 2),
        ),
        line: other.top + other.height / 2,
      },
    ];

    for (const item of verticalComparisons) {
      if (item.distance < horizontalDistance) {
        horizontalDistance = item.distance;
        horizontal = item.line;
      }
    }
  }

  return { horizontal, vertical };
}
