import type { CanvasNodeType } from "@/lib/tu-shared-browser";
import type { CanvasFlowNode } from "./canvas-store";

const NODE_WIDTH: Record<CanvasNodeType, number> = {
  text: 220,
  image: 240,
  video: 280,
  audio: 220,
  group: 360,
};

const NODE_HEIGHT: Record<CanvasNodeType, number> = {
  text: 120,
  image: 242,
  video: 160,
  audio: 120,
  group: 280,
};

const COLUMN_GAP = 120;
const ROW_GAP = 48;
const GROUP_COLUMN_GAP = 80;
const GROUP_ROW_GAP = 32;
const GROUP_PADDING_LEFT = 24;
const GROUP_PADDING_TOP = 40;
const GROUP_PADDING_RIGHT = 24;
const GROUP_PADDING_BOTTOM = 24;
const BARYCENTER_PASSES = 4;

type EdgeRef = { source: string; target: string };
export type CanvasAutoLayoutMode = "layered-lr" | "layered-tb" | "grid";
type LayoutDirection = "lr" | "tb";

function nodeWidth(node: CanvasFlowNode): number {
  return node.width ?? node.measured?.width ?? NODE_WIDTH[node.type];
}

function nodeHeight(node: CanvasFlowNode): number {
  return node.height ?? node.measured?.height ?? NODE_HEIGHT[node.type];
}

function compareById(left: CanvasFlowNode, right: CanvasFlowNode): number {
  return left.id.localeCompare(right.id);
}

/**
 * Kahn layering that always finishes: when a cycle blocks progress, pick the
 * remaining node with lowest indegree (stable by id) and force it into a layer.
 */
function assignLayers(
  nodes: CanvasFlowNode[],
  edges: ReadonlyArray<EdgeRef>,
): CanvasFlowNode[][] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    indegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    if (
      !byId.has(edge.source) ||
      !byId.has(edge.target) ||
      edge.source === edge.target
    ) {
      continue;
    }
    adjacency.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const layers: CanvasFlowNode[][] = [];
  const remaining = new Set(nodes.map((node) => node.id));
  while (remaining.size > 0) {
    let layer = nodes.filter(
      (node) =>
        remaining.has(node.id) && (indegree.get(node.id) ?? 0) === 0,
    );
    if (layer.length === 0) {
      let forced: CanvasFlowNode | null = null;
      for (const node of nodes) {
        if (!remaining.has(node.id)) {
          continue;
        }
        if (
          !forced ||
          (indegree.get(node.id) ?? 0) < (indegree.get(forced.id) ?? 0) ||
          ((indegree.get(node.id) ?? 0) === (indegree.get(forced.id) ?? 0) &&
            node.id < forced.id)
        ) {
          forced = node;
        }
      }
      if (!forced) {
        break;
      }
      layer = [forced];
    }
    layer.sort(compareById);
    layers.push(layer);
    for (const node of layer) {
      remaining.delete(node.id);
      for (const next of adjacency.get(node.id) ?? []) {
        if (remaining.has(next)) {
          indegree.set(next, Math.max(0, (indegree.get(next) ?? 0) - 1));
        }
      }
    }
  }
  return layers;
}

function barycenterOf(
  nodeId: string,
  neighborIds: ReadonlyArray<string>,
  order: Map<string, number>,
): number {
  const values = neighborIds
    .map((id) => order.get(id))
    .filter((value): value is number => value !== undefined);
  if (values.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Bidirectional multi-pass barycenter ordering to reduce edge crossings.
 */
function orderLayers(
  layers: CanvasFlowNode[][],
  edges: ReadonlyArray<EdgeRef>,
): void {
  if (layers.length < 2) {
    return;
  }
  const byId = new Map(
    layers.flatMap((layer) => layer.map((node) => [node.id, node] as const)),
  );
  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();
  for (const nodeId of byId.keys()) {
    predecessors.set(nodeId, []);
    successors.set(nodeId, []);
  }
  for (const edge of edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) {
      continue;
    }
    predecessors.get(edge.target)?.push(edge.source);
    successors.get(edge.source)?.push(edge.target);
  }

  for (let pass = 0; pass < BARYCENTER_PASSES; pass += 1) {
    const forward = pass % 2 === 0;
    if (forward) {
      for (let index = 1; index < layers.length; index += 1) {
        const previousOrder = new Map(
          layers[index - 1].map((node, position) => [node.id, position]),
        );
        const stableIndex = new Map(
          layers[index].map((node, position) => [node.id, position]),
        );
        layers[index].sort((left, right) => {
          const leftScore = barycenterOf(
            left.id,
            predecessors.get(left.id) ?? [],
            previousOrder,
          );
          const rightScore = barycenterOf(
            right.id,
            predecessors.get(right.id) ?? [],
            previousOrder,
          );
          if (leftScore !== rightScore) {
            return leftScore - rightScore;
          }
          return (
            (stableIndex.get(left.id) ?? 0) - (stableIndex.get(right.id) ?? 0)
          );
        });
      }
    } else {
      for (let index = layers.length - 2; index >= 0; index -= 1) {
        const nextOrder = new Map(
          layers[index + 1].map((node, position) => [node.id, position]),
        );
        const stableIndex = new Map(
          layers[index].map((node, position) => [node.id, position]),
        );
        layers[index].sort((left, right) => {
          const leftScore = barycenterOf(
            left.id,
            successors.get(left.id) ?? [],
            nextOrder,
          );
          const rightScore = barycenterOf(
            right.id,
            successors.get(right.id) ?? [],
            nextOrder,
          );
          if (leftScore !== rightScore) {
            return leftScore - rightScore;
          }
          return (
            (stableIndex.get(left.id) ?? 0) - (stableIndex.get(right.id) ?? 0)
          );
        });
      }
    }
  }
}

/**
 * Layered layout for a (possibly cyclic) digraph. Always returns positions.
 */
function layoutFlat(
  nodes: CanvasFlowNode[],
  edges: ReadonlyArray<EdgeRef>,
  columnGap: number,
  rowGap: number,
  direction: LayoutDirection,
): Map<string, { x: number; y: number }> {
  if (nodes.length === 0) {
    return new Map();
  }
  if (edges.length === 0) {
    const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    const columnWidths = new Array<number>(columns).fill(0);
    const rowHeights = new Array<number>(
      Math.ceil(nodes.length / columns),
    ).fill(0);
    for (let index = 0; index < nodes.length; index += 1) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      columnWidths[column] = Math.max(
        columnWidths[column],
        nodeWidth(nodes[index]),
      );
      rowHeights[row] = Math.max(rowHeights[row], nodeHeight(nodes[index]));
    }
    const positioned = new Map<string, { x: number; y: number }>();
    for (let index = 0; index < nodes.length; index += 1) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = columnWidths
        .slice(0, column)
        .reduce((sum, width) => sum + width + columnGap, 0);
      const y = rowHeights
        .slice(0, row)
        .reduce((sum, height) => sum + height + rowGap, 0);
      positioned.set(nodes[index].id, { x, y });
    }
    return positioned;
  }

  const layers = assignLayers(nodes, edges);
  orderLayers(layers, edges);

  const positioned = new Map<string, { x: number; y: number }>();
  if (direction === "tb") {
    let y = 0;
    for (const layer of layers) {
      const rowHeight = Math.max(...layer.map(nodeHeight));
      const totalWidth =
        layer.reduce((sum, node) => sum + nodeWidth(node), 0) +
        columnGap * Math.max(0, layer.length - 1);
      let x = -totalWidth / 2;
      for (const node of layer) {
        const width = nodeWidth(node);
        const height = nodeHeight(node);
        positioned.set(node.id, {
          x,
          y: y + (rowHeight - height) / 2,
        });
        x += width + columnGap;
      }
      y += rowHeight + rowGap;
    }
    return positioned;
  }

  let x = 0;
  for (const layer of layers) {
    const columnWidth = Math.max(...layer.map(nodeWidth));
    const totalHeight =
      layer.reduce((sum, node) => sum + nodeHeight(node), 0) +
      rowGap * Math.max(0, layer.length - 1);
    let y = -totalHeight / 2;
    for (const node of layer) {
      const width = nodeWidth(node);
      const height = nodeHeight(node);
      positioned.set(node.id, {
        x: x + (columnWidth - width) / 2,
        y,
      });
      y += height + rowGap;
    }
    x += columnWidth + columnGap;
  }
  return positioned;
}

function findComponents(
  nodes: CanvasFlowNode[],
  edges: ReadonlyArray<EdgeRef>,
): CanvasFlowNode[][] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) {
      continue;
    }
    adjacency.get(edge.source)?.push(edge.target);
    adjacency.get(edge.target)?.push(edge.source);
  }
  const visited = new Set<string>();
  const components: CanvasFlowNode[][] = [];
  for (const node of nodes) {
    if (visited.has(node.id)) {
      continue;
    }
    const component: CanvasFlowNode[] = [];
    const queue = [node.id];
    visited.add(node.id);
    while (queue.length > 0) {
      const id = queue.shift()!;
      const current = byId.get(id);
      if (current) {
        component.push(current);
      }
      for (const next of adjacency.get(id) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    components.push(component);
  }
  return components;
}

/**
 * Lay out each connected component independently, then pack the component
 * bounding boxes into a tidy grid.
 */
function layoutComponents(
  nodes: CanvasFlowNode[],
  edges: ReadonlyArray<EdgeRef>,
  direction: LayoutDirection,
): Map<string, { x: number; y: number }> {
  if (nodes.length === 0) {
    return new Map();
  }
  const components = findComponents(nodes, edges);
  const blocks: Array<{
    positions: Map<string, { x: number; y: number }>;
    width: number;
    height: number;
  }> = [];

  for (const component of components) {
    const componentIds = new Set(component.map((node) => node.id));
    const componentEdges = edges.filter(
      (edge) =>
        componentIds.has(edge.source) && componentIds.has(edge.target),
    );
    const positions = layoutFlat(
      component,
      componentEdges,
      COLUMN_GAP,
      ROW_GAP,
      direction,
    );
    const minX = Math.min(...[...positions.values()].map((point) => point.x));
    const minY = Math.min(...[...positions.values()].map((point) => point.y));
    let width = 0;
    let height = 0;
    const normalized = new Map<string, { x: number; y: number }>();
    for (const node of component) {
      const position = positions.get(node.id);
      if (!position) {
        continue;
      }
      const x = position.x - minX;
      const y = position.y - minY;
      normalized.set(node.id, { x, y });
      width = Math.max(width, x + nodeWidth(node));
      height = Math.max(height, y + nodeHeight(node));
    }
    blocks.push({ positions: normalized, width, height });
  }

  const columns = Math.min(3, Math.max(1, blocks.length));
  const columnWidths = new Array<number>(columns).fill(0);
  const rowHeights = new Array<number>(
    Math.ceil(blocks.length / columns),
  ).fill(0);
  blocks.forEach((block, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    columnWidths[column] = Math.max(columnWidths[column], block.width);
    rowHeights[row] = Math.max(rowHeights[row], block.height);
  });

  const positioned = new Map<string, { x: number; y: number }>();
  blocks.forEach((block, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const offsetX = columnWidths
      .slice(0, column)
      .reduce((sum, width) => sum + width + COLUMN_GAP, 0);
    const offsetY = rowHeights
      .slice(0, row)
      .reduce((sum, height) => sum + height + ROW_GAP, 0);
    for (const [id, position] of block.positions) {
      positioned.set(id, {
        x: offsetX + position.x,
        y: offsetY + position.y,
      });
    }
  });
  return positioned;
}

/**
 * Map an endpoint to its top-level layout participant: the group if nested,
 * otherwise the node itself.
 */
function topLevelEndpoint(
  nodeId: string,
  byId: Map<string, CanvasFlowNode>,
): string | null {
  const node = byId.get(nodeId);
  if (!node) {
    return null;
  }
  if (node.type === "group") {
    return node.id;
  }
  if (node.parentId) {
    return node.parentId;
  }
  return node.id;
}

/**
 * Lift edges so groups participate in top-level layering via their children's
 * external connections. Same-group edges are dropped (handled inside the group).
 */
function liftTopLevelEdges(
  nodes: CanvasFlowNode[],
  edges: ReadonlyArray<EdgeRef>,
  topLevelIds: Set<string>,
): EdgeRef[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const lifted: EdgeRef[] = [];
  const seen = new Set<string>();
  for (const edge of edges) {
    const source = topLevelEndpoint(edge.source, byId);
    const target = topLevelEndpoint(edge.target, byId);
    if (!source || !target || source === target) {
      continue;
    }
    if (!topLevelIds.has(source) || !topLevelIds.has(target)) {
      continue;
    }
    const key = `${source}->${target}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    lifted.push({ source, target });
  }
  return lifted;
}

export function canvasLayoutPositionsEqual(
  previous: CanvasFlowNode[],
  next: CanvasFlowNode[],
): boolean {
  if (previous.length !== next.length) {
    return false;
  }
  const previousById = new Map(previous.map((node) => [node.id, node]));
  for (const node of next) {
    const before = previousById.get(node.id);
    if (!before) {
      return false;
    }
    if (
      before.position.x !== node.position.x ||
      before.position.y !== node.position.y ||
      before.width !== node.width ||
      before.height !== node.height
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Group-aware layered layout.
 * Children are laid out inside their group first, then groups participate
 * in the canvas-level layout as single blocks (including via lifted edges).
 */
export function layoutCanvasNodes(
  nodes: CanvasFlowNode[],
  edges: ReadonlyArray<EdgeRef>,
  mode: CanvasAutoLayoutMode = "layered-lr",
): CanvasFlowNode[] {
  if (nodes.length === 0) {
    return nodes;
  }

  const direction: LayoutDirection =
    mode === "layered-tb" ? "tb" : "lr";
  const groups = nodes.filter((node) => node.type === "group");
  const groupSizes = new Map<string, { width: number; height: number }>();
  const childPositions = new Map<string, { x: number; y: number }>();

  for (const group of groups) {
    const children = nodes.filter((node) => node.parentId === group.id);
    if (children.length === 0) {
      continue;
    }
    const childIds = new Set(children.map((node) => node.id));
    const childEdges = edges.filter(
      (edge) => childIds.has(edge.source) && childIds.has(edge.target),
    );
    const positioned = layoutFlat(
      children,
      childEdges,
      GROUP_COLUMN_GAP,
      GROUP_ROW_GAP,
      direction,
    );
    const positions = [...positioned.values()];
    const minX = Math.min(...positions.map((position) => position.x));
    const minY = Math.min(...positions.map((position) => position.y));
    let maxRight = 0;
    let maxBottom = 0;
    for (const child of children) {
      const position = positioned.get(child.id);
      if (!position) {
        continue;
      }
      const x = position.x - minX + GROUP_PADDING_LEFT;
      const y = position.y - minY + GROUP_PADDING_TOP;
      childPositions.set(child.id, { x, y });
      maxRight = Math.max(maxRight, x + nodeWidth(child));
      maxBottom = Math.max(maxBottom, y + nodeHeight(child));
    }
    groupSizes.set(group.id, {
      width: Math.max(320, maxRight + GROUP_PADDING_RIGHT),
      height: Math.max(220, maxBottom + GROUP_PADDING_BOTTOM),
    });
  }

  const working = nodes.map((node) => {
    const childPosition = childPositions.get(node.id);
    const groupSize =
      node.type === "group" ? groupSizes.get(node.id) : undefined;
    return {
      ...node,
      ...(childPosition ? { position: childPosition } : {}),
      ...(groupSize
        ? { width: groupSize.width, height: groupSize.height }
        : {}),
    };
  });

  const topLevel = working.filter(
    (node) => node.type === "group" || !node.parentId,
  );

  if (mode === "grid") {
    const gapX = 80;
    const gapY = 64;
    const columns = Math.max(1, Math.ceil(Math.sqrt(topLevel.length)));
    const columnWidths = new Array<number>(columns).fill(0);
    const rowHeights = new Array<number>(
      Math.ceil(topLevel.length / columns),
    ).fill(0);
    for (let index = 0; index < topLevel.length; index += 1) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      columnWidths[column] = Math.max(
        columnWidths[column],
        nodeWidth(topLevel[index]),
      );
      rowHeights[row] = Math.max(
        rowHeights[row],
        nodeHeight(topLevel[index]),
      );
    }
    const positioned = new Map<string, { x: number; y: number }>();
    for (let index = 0; index < topLevel.length; index += 1) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = columnWidths
        .slice(0, column)
        .reduce((sum, width) => sum + width + gapX, 0);
      const y = rowHeights
        .slice(0, row)
        .reduce((sum, height) => sum + height + gapY, 0);
      positioned.set(topLevel[index].id, { x, y });
    }
    return working.map((node) => {
      const position = positioned.get(node.id);
      return position ? { ...node, position } : node;
    });
  }

  const topLevelIds = new Set(topLevel.map((node) => node.id));
  const topLevelEdges = liftTopLevelEdges(nodes, edges, topLevelIds);
  const positioned = layoutComponents(topLevel, topLevelEdges, direction);

  return working.map((node) => {
    const position = positioned.get(node.id);
    return position ? { ...node, position } : node;
  });
}
