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
/** Barycenter sweeps; each sweep is followed by a transpose cleanup. */
const BARYCENTER_PASSES = 6;
/** Wide canvases read better than tall ones; component packing targets this. */
const TARGET_ASPECT = 1.6;

type EdgeRef = { source: string; target: string };
export type CanvasAutoLayoutMode = "layered-lr" | "layered-tb" | "grid";
type LayoutDirection = "lr" | "tb";

/**
 * A vertex of the layered graph. Real vertices are nodes; **dummy** vertices are
 * routing slots for edges that span more than one layer, so long edges take part
 * in the crossing-reduction ordering instead of being ignored.
 */
type Vertex = {
  id: string;
  width: number;
  height: number;
  dummy: boolean;
};

type Positioned = Map<string, { x: number; y: number }>;

/** Node copy used while laying out: width/height become writable. */
type WorkingNode = Omit<CanvasFlowNode, "width" | "height"> & {
  width?: number;
  height?: number;
};

function nodeWidth(node: Pick<CanvasFlowNode, "type" | "width" | "height" | "measured">): number {
  return node.width ?? node.measured?.width ?? NODE_WIDTH[node.type];
}

function nodeHeight(node: Pick<CanvasFlowNode, "type" | "width" | "height" | "measured">): number {
  return node.height ?? node.measured?.height ?? NODE_HEIGHT[node.type];
}

function compareById(left: { id: string }, right: { id: string }): number {
  return left.id.localeCompare(right.id);
}

function toVertex(node: CanvasFlowNode): Vertex {
  return {
    id: node.id,
    width: nodeWidth(node),
    height: nodeHeight(node),
    dummy: false,
  };
}

function indexVertices(vertices: Vertex[]): Map<string, Vertex> {
  return new Map(vertices.map((vertex) => [vertex.id, vertex]));
}

/* -------------------------------------------------------------------------- */
/* Layering                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Longest-path layering with a queue-based Kahn sweep. Cycles cannot stall the
 * sweep: when no vertex has indegree 0 the remaining vertex with the lowest
 * indegree (id as tie-break) is forced into the next layer, which keeps the
 * layout total for cyclic graphs.
 */
function assignLayers(vertices: Vertex[], edges: EdgeRef[]): Vertex[][] {
  const byId = indexVertices(vertices);
  const indegree = new Map<string, number>();
  const successors = new Map<string, string[]>();
  for (const vertex of vertices) {
    indegree.set(vertex.id, 0);
    successors.set(vertex.id, []);
  }
  for (const edge of edges) {
    if (
      !byId.has(edge.source) ||
      !byId.has(edge.target) ||
      edge.source === edge.target
    ) {
      continue;
    }
    successors.get(edge.source)!.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const layers: Vertex[][] = [];
  const placed = new Set<string>();
  const queued = new Set<string>();
  let ready: Vertex[] = [];
  for (const vertex of vertices) {
    if ((indegree.get(vertex.id) ?? 0) === 0) {
      ready.push(vertex);
      queued.add(vertex.id);
    }
  }

  while (placed.size < vertices.length) {
    if (ready.length === 0) {
      // Cyclic remainder: force the least-constrained vertex into this layer.
      let forced: Vertex | null = null;
      for (const vertex of vertices) {
        if (placed.has(vertex.id)) {
          continue;
        }
        if (
          !forced ||
          (indegree.get(vertex.id) ?? 0) < (indegree.get(forced.id) ?? 0) ||
          ((indegree.get(vertex.id) ?? 0) === (indegree.get(forced.id) ?? 0) &&
            vertex.id < forced.id)
        ) {
          forced = vertex;
        }
      }
      if (!forced) {
        break;
      }
      ready.push(forced);
      queued.add(forced.id);
    }

    const layer = ready;
    ready = [];
    layer.sort(compareById);
    layers.push(layer);
    for (const vertex of layer) {
      placed.add(vertex.id);
      queued.delete(vertex.id);
      for (const nextId of successors.get(vertex.id) ?? []) {
        if (placed.has(nextId)) {
          continue;
        }
        const next = (indegree.get(nextId) ?? 0) - 1;
        indegree.set(nextId, Math.max(0, next));
        if (next <= 0 && !queued.has(nextId)) {
          const target = byId.get(nextId);
          if (target) {
            ready.push(target);
            queued.add(nextId);
          }
        }
      }
    }
  }
  return layers;
}

/**
 * Split edges that span more than one layer into chains through dummy vertices.
 * Without this, a long edge contributes nothing to the crossing heuristic
 * (barycenter only looks at the adjacent layer) and its crossings pile up.
 */
function expandLongEdges(
  layers: Vertex[][],
  edges: EdgeRef[],
): EdgeRef[] {
  const layerOf = new Map<string, number>();
  layers.forEach((layer, index) => {
    for (const vertex of layer) {
      layerOf.set(vertex.id, index);
    }
  });
  const expanded: EdgeRef[] = [];
  let dummyCount = 0;
  for (const edge of edges) {
    const from = layerOf.get(edge.source);
    const to = layerOf.get(edge.target);
    if (from === undefined || to === undefined || to - from <= 1) {
      expanded.push(edge);
      continue;
    }
    let previous = edge.source;
    for (let layer = from + 1; layer < to; layer += 1) {
      const dummy: Vertex = {
        id: `__dummy:${edge.source}->${edge.target}#${dummyCount++}`,
        width: 0,
        height: 0,
        dummy: true,
      };
      layers[layer]!.push(dummy);
      expanded.push({ source: previous, target: dummy.id });
      previous = dummy.id;
    }
    expanded.push({ source: previous, target: edge.target });
  }
  return expanded;
}

/* -------------------------------------------------------------------------- */
/* Crossing reduction                                                          */
/* -------------------------------------------------------------------------- */

function neighborPositions(
  ids: readonly string[],
  order: ReadonlyMap<string, number>,
): number[] {
  const positions: number[] = [];
  for (const id of ids) {
    const position = order.get(id);
    if (position !== undefined) {
      positions.push(position);
    }
  }
  return positions;
}

/** Crossings introduced by placing `left` before `right`. */
function pairCrossings(left: number[], right: number[]): number {
  let crossings = 0;
  for (const a of left) {
    for (const b of right) {
      if (a > b) {
        crossings += 1;
      }
    }
  }
  return crossings;
}

function barycenterSort(
  layer: Vertex[],
  neighbors: (id: string) => number[],
): void {
  const stableIndex = new Map(layer.map((vertex, index) => [vertex.id, index]));
  layer.sort((left, right) => {
    const leftValues = neighbors(left.id);
    const rightValues = neighbors(right.id);
    const leftScore =
      leftValues.length === 0
        ? Number.POSITIVE_INFINITY
        : leftValues.reduce((sum, value) => sum + value, 0) /
          leftValues.length;
    const rightScore =
      rightValues.length === 0
        ? Number.POSITIVE_INFINITY
        : rightValues.reduce((sum, value) => sum + value, 0) /
          rightValues.length;
    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }
    return (stableIndex.get(left.id) ?? 0) - (stableIndex.get(right.id) ?? 0);
  });
}

function orderLayers(layers: Vertex[][], edges: EdgeRef[]): void {
  if (layers.length < 2) {
    return;
  }
  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();
  for (const layer of layers) {
    for (const vertex of layer) {
      predecessors.set(vertex.id, []);
      successors.set(vertex.id, []);
    }
  }
  for (const edge of edges) {
    if (!predecessors.has(edge.target) || !successors.has(edge.source)) {
      continue;
    }
    predecessors.get(edge.target)!.push(edge.source);
    successors.get(edge.source)!.push(edge.target);
  }

  for (let pass = 0; pass < BARYCENTER_PASSES; pass += 1) {
    const forward = pass % 2 === 0;
    if (forward) {
      for (let index = 1; index < layers.length; index += 1) {
        const previousOrder = new Map(
          layers[index - 1]!.map((vertex, position) => [vertex.id, position]),
        );
        const neighbours = (id: string) =>
          neighborPositions(predecessors.get(id) ?? [], previousOrder);
        barycenterSort(layers[index]!, neighbours);
      }
    } else {
      for (let index = layers.length - 2; index >= 0; index -= 1) {
        const nextOrder = new Map(
          layers[index + 1]!.map((vertex, position) => [vertex.id, position]),
        );
        const neighbours = (id: string) =>
          neighborPositions(successors.get(id) ?? [], nextOrder);
        barycenterSort(layers[index]!, neighbours);
      }
    }
  }

  // Transpose against both adjacent layers, repeatedly until stable.
  for (let pass = 0; pass < 2; pass += 1) {
    let changed = false;
    for (let index = 0; index < layers.length; index += 1) {
      const layer = layers[index]!;
      const previousOrder =
        index > 0
          ? new Map(
              layers[index - 1]!.map((vertex, position) => [
                vertex.id,
                position,
              ]),
            )
          : null;
      const nextOrder =
        index + 1 < layers.length
          ? new Map(
              layers[index + 1]!.map((vertex, position) => [
                vertex.id,
                position,
              ]),
            )
          : null;
      for (let position = 0; position + 1 < layer.length; position += 1) {
        const left = layer[position]!;
        const right = layer[position + 1]!;
        let delta = 0;
        if (previousOrder) {
          delta +=
            pairCrossings(
              neighborPositions(predecessors.get(left.id) ?? [], previousOrder),
              neighborPositions(predecessors.get(right.id) ?? [], previousOrder),
            ) -
            pairCrossings(
              neighborPositions(predecessors.get(right.id) ?? [], previousOrder),
              neighborPositions(predecessors.get(left.id) ?? [], previousOrder),
            );
        }
        if (nextOrder) {
          delta +=
            pairCrossings(
              neighborPositions(successors.get(left.id) ?? [], nextOrder),
              neighborPositions(successors.get(right.id) ?? [], nextOrder),
            ) -
            pairCrossings(
              neighborPositions(successors.get(right.id) ?? [], nextOrder),
              neighborPositions(successors.get(left.id) ?? [], nextOrder),
            );
        }
        if (delta > 0) {
          layer[position] = right;
          layer[position + 1] = left;
          changed = true;
        }
      }
    }
    if (!changed) {
      break;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Coordinates                                                                 */
/* -------------------------------------------------------------------------- */

function placeLayers(
  layers: Vertex[][],
  direction: LayoutDirection,
  columnGap: number,
  rowGap: number,
): Positioned {
  const positioned: Positioned = new Map();

  if (direction === "tb") {
    let y = 0;
    for (const layer of layers) {
      const rowHeight = Math.max(...layer.map((vertex) => vertex.height));
      const totalWidth =
        layer.reduce((sum, vertex) => sum + vertex.width, 0) +
        columnGap * Math.max(0, layer.length - 1);
      let x = -totalWidth / 2;
      for (const vertex of layer) {
        positioned.set(vertex.id, {
          x,
          y: y + (rowHeight - vertex.height) / 2,
        });
        x += vertex.width + columnGap;
      }
      y += rowHeight + rowGap;
    }
    return positioned;
  }

  let x = 0;
  for (const layer of layers) {
    const columnWidth = Math.max(...layer.map((vertex) => vertex.width));
    const totalHeight =
      layer.reduce((sum, vertex) => sum + vertex.height, 0) +
      rowGap * Math.max(0, layer.length - 1);
    let y = -totalHeight / 2;
    for (const vertex of layer) {
      positioned.set(vertex.id, {
        x: x + (columnWidth - vertex.width) / 2,
        y,
      });
      y += vertex.height + rowGap;
    }
    x += columnWidth + columnGap;
  }
  return positioned;
}

/**
 * Layered layout for a (possibly cyclic) digraph. Long edges get routing
 * vertices, the order is reduced with barycenter + transpose, then each layer is
 * stacked as a column (LR) or a row (TB). Always returns positions for every
 * real node.
 */
function layoutFlat(
  nodes: CanvasFlowNode[],
  edges: ReadonlyArray<EdgeRef>,
  columnGap: number,
  rowGap: number,
  direction: LayoutDirection,
): Positioned {
  if (nodes.length === 0) {
    return new Map();
  }
  if (edges.length === 0) {
    return layoutGrid(nodes, columnGap, rowGap);
  }

  const vertices = nodes.map(toVertex);
  const layers = assignLayers(vertices, edges as EdgeRef[]);
  const expandedEdges = expandLongEdges(layers, edges as EdgeRef[]);
  orderLayers(layers, expandedEdges);
  const allPositions = placeLayers(layers, direction, columnGap, rowGap);

  const positioned: Positioned = new Map();
  for (const node of nodes) {
    const position = allPositions.get(node.id);
    if (position) {
      positioned.set(node.id, position);
    }
  }
  return positioned;
}

/** Square-ish grid, used for edge-less graphs and the explicit grid mode. */
function layoutGrid(
  nodes: CanvasFlowNode[],
  columnGap: number,
  rowGap: number,
): Positioned {
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const rows = Math.ceil(nodes.length / columns);
  const columnWidths = new Array<number>(columns).fill(0);
  const rowHeights = new Array<number>(rows).fill(0);
  nodes.forEach((node, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    columnWidths[column] = Math.max(columnWidths[column]!, nodeWidth(node));
    rowHeights[row] = Math.max(rowHeights[row]!, nodeHeight(node));
  });
  const positioned: Positioned = new Map();
  nodes.forEach((node, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    let x = 0;
    for (let i = 0; i < column; i += 1) {
      x += columnWidths[i]! + columnGap;
    }
    let y = 0;
    for (let i = 0; i < row; i += 1) {
      y += rowHeights[i]! + rowGap;
    }
    positioned.set(node.id, { x, y });
  });
  return positioned;
}

/* -------------------------------------------------------------------------- */
/* Components                                                                  */
/* -------------------------------------------------------------------------- */

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
    adjacency.get(edge.source)!.push(edge.target);
    adjacency.get(edge.target)!.push(edge.source);
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

type Block = { positions: Positioned; width: number; height: number };

/**
 * Lay out each connected component on its own, then pack the blocks into a grid
 * whose column count keeps the result closest to {@link TARGET_ASPECT}.
 */
function layoutComponents(
  nodes: CanvasFlowNode[],
  edges: ReadonlyArray<EdgeRef>,
  direction: LayoutDirection,
): Positioned {
  if (nodes.length === 0) {
    return new Map();
  }
  const components = findComponents(nodes, edges);
  const blocks: Block[] = [];

  for (const component of components) {
    const componentIds = new Set(component.map((node) => node.id));
    const componentEdges = edges.filter(
      (edge) => componentIds.has(edge.source) && componentIds.has(edge.target),
    );
    const positions = layoutFlat(
      component,
      componentEdges,
      COLUMN_GAP,
      ROW_GAP,
      direction,
    );
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    for (const point of positions.values()) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      minX = 0;
      minY = 0;
    }
    let width = 0;
    let height = 0;
    const normalized: Positioned = new Map();
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

  const columns = chooseColumns(blocks);
  const columnWidths = new Array<number>(columns).fill(0);
  const rowHeights = new Array<number>(Math.ceil(blocks.length / columns)).fill(
    0,
  );
  blocks.forEach((block, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    columnWidths[column] = Math.max(columnWidths[column]!, block.width);
    rowHeights[row] = Math.max(rowHeights[row]!, block.height);
  });

  const positioned: Positioned = new Map();
  blocks.forEach((block, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    let offsetX = 0;
    for (let i = 0; i < column; i += 1) {
      offsetX += columnWidths[i]! + COLUMN_GAP;
    }
    let offsetY = 0;
    for (let i = 0; i < row; i += 1) {
      offsetY += rowHeights[i]! + ROW_GAP;
    }
    for (const [id, position] of block.positions) {
      positioned.set(id, {
        x: offsetX + position.x,
        y: offsetY + position.y,
      });
    }
  });
  return positioned;
}

/** Column count whose packed bounding box is closest to a 16:10 canvas. */
function chooseColumns(blocks: Block[]): number {
  if (blocks.length <= 1) {
    return 1;
  }
  let best = 1;
  let bestScore = Number.POSITIVE_INFINITY;
  const maxColumns = Math.min(6, blocks.length);
  for (let columns = 1; columns <= maxColumns; columns += 1) {
    const columnWidths = new Array<number>(columns).fill(0);
    const rowHeights = new Array<number>(
      Math.ceil(blocks.length / columns),
    ).fill(0);
    blocks.forEach((block, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      columnWidths[column] = Math.max(columnWidths[column]!, block.width);
      rowHeights[row] = Math.max(rowHeights[row]!, block.height);
    });
    const width =
      columnWidths.reduce((sum, value) => sum + value, 0) +
      COLUMN_GAP * (columns - 1);
    const height =
      rowHeights.reduce((sum, value) => sum + value, 0) +
      ROW_GAP * (rowHeights.length - 1);
    const score = Math.abs(Math.log(width / Math.max(height, 1) / TARGET_ASPECT));
    if (score < bestScore) {
      bestScore = score;
      best = columns;
    }
  }
  return best;
}

/* -------------------------------------------------------------------------- */
/* Top level                                                                   */
/* -------------------------------------------------------------------------- */

/** Container a node is laid out in: its group when nested, otherwise itself. */
function topLevelEndpoint(
  nodeId: string,
  byId: Map<string, CanvasFlowNode>,
  containerOf: (id: string) => string,
): string | null {
  const node = byId.get(nodeId);
  if (!node) {
    return null;
  }
  return containerOf(node.id);
}

/**
 * Map every node to the outermost container it belongs to, ignoring dangling
 * parents (a node whose parent does not exist is its own container).
 */
function makeContainerResolver(
  nodes: readonly CanvasFlowNode[],
): (id: string) => string {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const cache = new Map<string, string>();
  return (id: string): string => {
    const cached = cache.get(id);
    if (cached) {
      return cached;
    }
    let current = id;
    const seen = new Set<string>();
    for (;;) {
      const node = byId.get(current);
      if (!node) {
        break;
      }
      const parentId = node.parentId;
      if (!parentId || !byId.has(parentId) || seen.has(parentId)) {
        break;
      }
      seen.add(parentId);
      current = parentId;
    }
    cache.set(id, current);
    return current;
  };
}

/**
 * Lift child edges to their containers so a group's external connections decide
 * where the group sits. Intra-container edges are dropped (handled inside).
 */
function liftTopLevelEdges(
  nodes: readonly CanvasFlowNode[],
  edges: ReadonlyArray<EdgeRef>,
  topLevelIds: Set<string>,
  containerOf: (id: string) => string,
): EdgeRef[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const lifted: EdgeRef[] = [];
  const seen = new Set<string>();
  for (const edge of edges) {
    const source = topLevelEndpoint(edge.source, byId, containerOf);
    const target = topLevelEndpoint(edge.target, byId, containerOf);
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

/** Group nesting depth (0 for a root group), cycle-safe. */
function groupDepth(
  node: CanvasFlowNode,
  byId: Map<string, CanvasFlowNode>,
): number {
  let depth = 0;
  let parentId = node.parentId;
  const seen = new Set<string>([node.id]);
  while (parentId) {
    if (seen.has(parentId)) {
      break;
    }
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) {
      break;
    }
    depth += 1;
    parentId = parent.parentId;
  }
  return depth;
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

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
 *
 * 1. Groups are laid out bottom-up (deepest first): children inside the group,
 *    the group then sized to fit them.
 * 2. Groups and root nodes become the top-level graph, with edges lifted to
 *    their containers.
 * 3. Each connected component is layered on its own (Kahn + dummy vertices +
 *    barycenter/transpose), then components are packed into a grid.
 * 4. The grid mode skips layering and places root nodes in a square grid.
 */
export function layoutCanvasNodes(
  nodes: CanvasFlowNode[],
  edges: ReadonlyArray<EdgeRef>,
  mode: CanvasAutoLayoutMode = "layered-lr",
): CanvasFlowNode[] {
  if (nodes.length === 0) {
    return nodes;
  }

  const direction: LayoutDirection = mode === "layered-tb" ? "tb" : "lr";
  const working = new Map<string, WorkingNode>(
    nodes.map((node) => [node.id, { ...node } as WorkingNode]),
  );
  const byId = new Map(nodes.map((node) => [node.id, node]));

  // --- 1. groups, deepest first ------------------------------------------
  const groups = nodes
    .filter((node) => node.type === "group")
    .sort((left, right) => {
      const depthDelta =
        groupDepth(right, byId) - groupDepth(left, byId);
      return depthDelta !== 0 ? depthDelta : compareById(left, right);
    });

  for (const group of groups) {
    const groupNode = working.get(group.id);
    if (!groupNode) {
      continue;
    }
    const children = nodes
      .filter((node) => node.parentId === group.id)
      .map((node) => working.get(node.id))
      .filter((node): node is CanvasFlowNode => Boolean(node));
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
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    for (const point of positioned.values()) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      minX = 0;
      minY = 0;
    }
    let maxRight = GROUP_PADDING_LEFT;
    let maxBottom = GROUP_PADDING_TOP;
    for (const child of children) {
      const position = positioned.get(child.id);
      if (!position) {
        continue;
      }
      const x = position.x - minX + GROUP_PADDING_LEFT;
      const y = position.y - minY + GROUP_PADDING_TOP;
      child.position = { x, y };
      maxRight = Math.max(maxRight, x + nodeWidth(child));
      maxBottom = Math.max(maxBottom, y + nodeHeight(child));
    }
    groupNode.width = Math.max(320, maxRight + GROUP_PADDING_RIGHT);
    groupNode.height = Math.max(220, maxBottom + GROUP_PADDING_BOTTOM);
  }

  // --- 2. top level participants ----------------------------------------
  const containerOf = makeContainerResolver(nodes);
  const topLevel = [...working.values()].filter(
    (node) => containerOf(node.id) === node.id,
  );

  if (mode === "grid") {
    const positioned = layoutGrid(topLevel, 80, 64);
    return [...working.values()].map((node) => {
      const position = positioned.get(node.id);
      return position ? { ...node, position } : node;
    });
  }

  const topLevelIds = new Set(topLevel.map((node) => node.id));
  const topLevelEdges = liftTopLevelEdges(nodes, edges, topLevelIds, containerOf);
  const positioned = layoutComponents(topLevel, topLevelEdges, direction);

  return [...working.values()].map((node) => {
    const position = positioned.get(node.id);
    return position ? { ...node, position } : node;
  });
}
