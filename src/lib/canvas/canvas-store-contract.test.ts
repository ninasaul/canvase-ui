import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getLabelEntries,
  getMediaCounts,
  getSelection,
  getMentionEntries,
} from "./canvas-derived";
import { reconcileCanvasDisplayNodes } from "./canvas-display-nodes";
import { useCanvasStore, type CanvasFlowNode } from "./canvas-store";
import { useCanvasTransientStore } from "./canvas-transient-store";
import {
  canvasUpstreamImagesEqual,
  collectCanvasUpstreamImages,
  collectCanvasUpstreamPrompt,
} from "./canvas-upstream-media";

/**
 * Re-render contract for the canvas store.
 *
 * These tests stand in for React Profiler runs: they lock the invariants that
 * keep a store write from waking unrelated components.
 *
 *   1. A write touches only the nodes it changes (React Flow skips the rest by
 *      identity).
 *   2. A no-op write does not change state at all (no subscriber is notified).
 *   3. Transient UI state lives in its own store and never changes the graph.
 *   4. Derived selectors are cached per array identity, and their entries keep
 *      their identity across data-only edits.
 *   5. The display buffer keeps untouched node identities when it adopts store
 *      changes.
 */

let counter = 0;

function node(
  id: string,
  data: Record<string, unknown> = {},
  type: CanvasFlowNode["type"] = "image",
): CanvasFlowNode {
  return {
    id,
    type,
    position: { x: counter++ * 100, y: 0 },
    width: 240,
    height: 200,
    data: { label: id, ...data },
  } as CanvasFlowNode;
}

function resetGraph(nodes: CanvasFlowNode[], edges: ReturnType<typeof edge>[] = []) {
  useCanvasStore.setState({ nodes, edges, settings: {} });
}

function edge(source: string, target: string, role = "reference_image") {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    type: "canvas",
    data: { role },
  } as never;
}

test("updateNodeData only replaces the edited node", () => {
  const a = node("a");
  const b = node("b");
  resetGraph([a, b]);

  useCanvasStore.getState().updateNodeData("a", { prompt: "hello" });

  const next = useCanvasStore.getState().nodes;
  assert.notEqual(next, [a, b]);
  assert.equal(next[1], b, "untouched node keeps its identity");
  assert.notEqual(next[0], a, "edited node is a new object");
  assert.equal(next[0]!.data.prompt, "hello");
});

test("no-op updateNodeData does not change the store", () => {
  const a = node("a", { prompt: "same" });
  resetGraph([a]);
  const before = useCanvasStore.getState();

  useCanvasStore.getState().updateNodeData("a", { prompt: "same" });

  assert.equal(useCanvasStore.getState(), before, "state object is untouched");
});

test("patchManyNodeData writes once and keeps untouched identities", () => {
  const a = node("a");
  const b = node("b");
  const c = node("c");
  resetGraph([a, b, c]);

  useCanvasStore.getState().patchManyNodeData({
    a: { status: "running" },
    b: { status: "queued" },
  });

  const next = useCanvasStore.getState().nodes;
  assert.equal(next[2], c);
  assert.equal(next[0]!.data.status, "running");
  assert.equal(next[1]!.data.status, "queued");
});

test("transient UI writes never touch the graph", () => {
  const a = node("a");
  resetGraph([a]);
  const graph = useCanvasStore.getState();

  useCanvasTransientStore.getState().setUploadProgress("a", 42);
  useCanvasTransientStore.getState().setSnapTargetId("a");
  useCanvasTransientStore.getState().setDragOverGroupId("g");

  assert.equal(useCanvasStore.getState(), graph, "graph state unchanged");
  assert.equal(useCanvasTransientStore.getState().uploadProgressById.a, 42);
  useCanvasTransientStore.getState().reset();
});

test("derived selectors are cached against the array identity", () => {
  const a = { ...node("a"), selected: true } as CanvasFlowNode;
  const b = node("b");
  const nodes = [a, b];
  useCanvasStore.setState({ nodes, edges: [], settings: {} });

  assert.equal(getSelection(nodes), getSelection(nodes), "selection cached");
  assert.equal(getLabelEntries(nodes), getLabelEntries(nodes), "labels cached");
  assert.equal(getMediaCounts(nodes), getMediaCounts(nodes), "counts cached");
  assert.equal(getMentionEntries(nodes), getMentionEntries(nodes), "mentions cached");
  assert.deepEqual(getSelection(nodes).ids, ["a"]);
});

test("label entries keep identity across prompt edits", () => {
  const a = node("a", { label: "Node A", prompt: "one" });
  const nodes = [a];
  const before = getLabelEntries(nodes)[0]!;

  const edited = { ...a, data: { ...a.data, prompt: "one two" } };
  const after = getLabelEntries([edited])[0]!;

  assert.equal(after, before, "same label snapshot, no re-render");
});

test("display buffer keeps untouched identities and bails on equality", () => {
  const a = node("a");
  const b = node("b");
  const display = [a, b];

  assert.equal(
    reconcileCanvasDisplayNodes(display, [a, b]),
    display,
    "no change → same array",
  );

  const editedB = { ...b, data: { ...b.data, prompt: "x" } };
  const next = reconcileCanvasDisplayNodes(display, [a, editedB]);
  assert.notEqual(next, display);
  assert.equal(next[0], a);
  assert.equal(next[1], editedB);
});

test("upstream media stays equal across unrelated node edits", () => {
  const source = node("src", { url: "https://cdn.example/a.png" });
  const target = node("dst", { prompt: "p" }, "video");
  const edges = [edge("src", "dst")];

  const before = collectCanvasUpstreamImages([source, target], edges, "dst");
  const editedTarget = { ...target, data: { ...target.data, prompt: "p2" } };
  const after = collectCanvasUpstreamImages([source, editedTarget], edges, "dst");

  assert.equal(canvasUpstreamImagesEqual(before, after), true);
  assert.equal(before[0]!.url, "https://cdn.example/a.png");
});

test("upstream prompt is ordered and ignores non-text sources", () => {
  const a = node("t1", { text: "one" }, "text");
  const b = node("t2", { text: "two" }, "text");
  const img = node("img", { url: "https://cdn.example/x.png" });
  const edges = [
    { id: "e2", source: "t2", target: "dst", data: { role: "prompt", order: 2 } },
    { id: "e1", source: "t1", target: "dst", data: { role: "context", order: 1 } },
    { id: "e3", source: "img", target: "dst", data: { role: "prompt", order: 0 } },
  ] as never[];

  assert.equal(
    collectCanvasUpstreamPrompt([a, b, img], edges as never, "dst"),
    "one\n\ntwo",
  );
});

test("removeNode drops the node and its edges", () => {
  const a = node("a");
  const b = node("b");
  resetGraph([a, b], [edge("a", "b")]);

  useCanvasStore.getState().removeNode("a");

  const state = useCanvasStore.getState();
  assert.deepEqual(
    state.nodes.map((item) => item.id),
    ["b"],
  );
  assert.equal(state.edges.length, 0);
});
