import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canvasLayoutPositionsEqual,
  layoutCanvasNodes,
  type CanvasAutoLayoutMode,
} from "./canvas-auto-layout";

type TestNode = {
  id: string;
  type: "image" | "text" | "group";
  position: { x: number; y: number };
  width?: number;
  height?: number;
  parentId?: string;
  data: Record<string, unknown>;
};

const node = (id: string, extra: Partial<TestNode> = {}): TestNode => ({
  id,
  type: "image",
  position: { x: 0, y: 0 },
  width: 240,
  height: 240,
  data: {},
  ...extra,
});

const edge = (source: string, target: string) => ({
  id: `${source}-${target}`,
  source,
  target,
  data: { role: "reference_image" },
});

const layout = (
  nodes: TestNode[],
  edges: ReturnType<typeof edge>[] = [],
  mode: CanvasAutoLayoutMode = "layered-lr",
) => layoutCanvasNodes(nodes as never, edges as never, mode) as unknown as TestNode[];

const byId = (nodes: TestNode[]) => new Map(nodes.map((n) => [n.id, n]));

function overlaps(nodes: TestNode[]): number {
  const top = nodes.filter((n) => n.type !== "group" && !n.parentId);
  let count = 0;
  for (let i = 0; i < top.length; i += 1) {
    for (let j = i + 1; j < top.length; j += 1) {
      const a = top[i]!;
      const b = top[j]!;
      const aw = a.width ?? 220;
      const ah = a.height ?? 120;
      const bw = b.width ?? 220;
      const bh = b.height ?? 120;
      if (
        a.position.x < b.position.x + bw &&
        b.position.x < a.position.x + aw &&
        a.position.y < b.position.y + bh &&
        b.position.y < a.position.y + ah
      ) {
        count += 1;
      }
    }
  }
  return count;
}

function randGraph(size: number, edgeCount: number, seed = 7) {
  let state = seed;
  const rnd = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  const nodes = Array.from({ length: size }, (_, index) =>
    node(`n${index}`),
  );
  const edges: ReturnType<typeof edge>[] = [];
  const seen = new Set<string>();
  while (edges.length < edgeCount) {
    const a = Math.floor(rnd() * size);
    const b = Math.floor(rnd() * size);
    if (a === b) continue;
    const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push(edge(`n${Math.min(a, b)}`, `n${Math.max(a, b)}`));
  }
  return { nodes, edges };
}

test("a chain is laid out one layer per column, left to right", () => {
  const out = layout(
    [node("a"), node("b"), node("c")],
    [edge("a", "b"), edge("b", "c")],
  );
  const pos = byId(out);
  assert.ok(pos.get("a")!.position.x < pos.get("b")!.position.x);
  assert.ok(pos.get("b")!.position.x < pos.get("c")!.position.x);
  assert.equal(overlaps(out), 0);
});

test("a cyclic graph still lays out, deterministically and finitely", () => {
  const nodes = [node("a"), node("b"), node("c")];
  const edges = [edge("a", "b"), edge("b", "c"), edge("c", "a")];
  const first = layout(nodes, edges);
  const second = layout(nodes, edges);
  for (const n of first) {
    assert.ok(Number.isFinite(n.position.x) && Number.isFinite(n.position.y));
  }
  assert.deepEqual(
    first.map((n) => [n.id, n.position.x, n.position.y]),
    second.map((n) => [n.id, n.position.x, n.position.y]),
  );
  assert.equal(overlaps(first), 0);
});

test("disconnected components are packed without overlapping", () => {
  const out = layout(
    [node("a"), node("b"), node("c"), node("d"), node("e")],
    [edge("a", "b"), edge("c", "d")],
  );
  assert.equal(overlaps(out), 0);
  // every node gets a position
  for (const n of out) {
    assert.ok(Number.isFinite(n.position.x) && Number.isFinite(n.position.y));
  }
});

test("groups size themselves around their children", () => {
  const group = node("g", { type: "group", width: 120, height: 120 });
  const children = [
    node("k1", { parentId: "g" }),
    node("k2", { parentId: "g" }),
    node("k3", { parentId: "g" }),
  ];
  const out = layout([group, ...children], [edge("k1", "k2"), edge("k2", "k3")]);
  const g = byId(out).get("g")!;
  assert.ok((g.width ?? 0) >= 320);
  for (const child of out.filter((n) => n.parentId === "g")) {
    assert.ok(child.position.x + (child.width ?? 0) <= (g.width ?? 0));
    assert.ok(child.position.y + (child.height ?? 0) <= (g.height ?? 0));
  }
});

test("a node with a dangling parent is treated as top level", () => {
  const out = layout([node("x", { parentId: "missing" }), node("y")]);
  const pos = byId(out);
  // Previously both were parked at (0,0); they must not collide now.
  assert.notDeepEqual(pos.get("x")!.position, pos.get("y")!.position);
  assert.equal(overlaps(out), 0);
});

test("nested groups are laid out inside their parent", () => {
  const outer = node("g2", { type: "group", width: 200, height: 200 });
  const inner = node("g3", { type: "group", width: 200, height: 200, parentId: "g2" });
  const leaf = node("leaf", { parentId: "g3" });
  const out = layout([outer, inner, leaf]);
  const pos = byId(out);
  const g2 = pos.get("g2")!;
  const g3 = pos.get("g3")!;
  assert.ok(g3.position.x >= 0 && g3.position.x + (g3.width ?? 0) <= (g2.width ?? 0));
  assert.ok(g3.position.y >= 0 && g3.position.y + (g3.height ?? 0) <= (g2.height ?? 0));
  assert.ok((g3.width ?? 0) >= 320);
  assert.ok(leaf.position.x >= 0 && leaf.position.x + (leaf.width ?? 0) <= (g3.width ?? 0));
});

test("layout is idempotent: running it twice changes nothing", () => {
  const { nodes, edges } = randGraph(40, 70);
  const once = layout(nodes, edges);
  const twice = layout(once, edges);
  assert.equal(canvasLayoutPositionsEqual(once, twice), true);
});

test("a 200-node random graph lays out without overlaps and fast", () => {
  const { nodes, edges } = randGraph(200, 400);
  const started = performance.now();
  const out = layout(nodes, edges);
  const elapsed = performance.now() - started;
  assert.equal(overlaps(out), 0);
  assert.ok(elapsed < 100, `layout took ${elapsed.toFixed(1)}ms`);
  assert.equal(out.length, 200);
});

test("grid mode keeps nested children relative to their group", () => {
  const group = node("g", { type: "group" });
  const child = node("c", { parentId: "g" });
  const out = layout([group, child, node("free")], [], "grid");
  const pos = byId(out);
  assert.ok((pos.get("c")!.position.x ?? 0) < (pos.get("g")!.width ?? 0));
  assert.ok(Number.isFinite(pos.get("free")!.position.x));
});
