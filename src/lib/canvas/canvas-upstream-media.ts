import { messages } from "@/messages";
import type { CanvasFlowEdge, CanvasFlowNode } from "./canvas-store";

export type CanvasUpstreamImage = {
  url: string;
  assetId?: string;
  name: string;
};

const ROLE_ORDER: Record<string, number> = {
  first_frame: 0,
  last_frame: 1,
  reference_image: 2,
};

const IMAGE_ROLES = new Set(["first_frame", "last_frame", "reference_image"]);

function nodeUrls(node: CanvasFlowNode): string[] {
  return [...(node.data.urls ?? []), node.data.url ?? ""].filter(Boolean);
}

/**
 * Images connected to a generation node, with frame roles ordered before
 * general reference images.
 *
 * Pure and edge-first: only the edges that point at `nodeId` are inspected, so
 * this can run inside a store selector without walking the whole graph.
 */
export function collectCanvasUpstreamImages(
  nodes: readonly CanvasFlowNode[],
  edges: readonly CanvasFlowEdge[],
  nodeId: string,
): CanvasUpstreamImage[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const incoming = edges
    .filter((edge) => {
      const role = edge.data?.role;
      return edge.target === nodeId && Boolean(role && IMAGE_ROLES.has(role));
    })
    .sort(
      (left, right) =>
        (ROLE_ORDER[left.data?.role ?? ""] ?? 9) -
          (ROLE_ORDER[right.data?.role ?? ""] ?? 9) ||
        (left.data?.order ?? 0) - (right.data?.order ?? 0),
    );

  const seen = new Set<string>();
  const result: CanvasUpstreamImage[] = [];
  for (const edge of incoming) {
    const source = byId.get(edge.source);
    if (!source || source.type !== "image") {
      continue;
    }
    const urls = nodeUrls(source);
    for (const [index, url] of urls.entries()) {
      const trimmed = url.trim();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      const assetId = source.data.assetIds?.[index] ?? source.data.assetId;
      const label = source.data.label?.trim();
      result.push({
        url: trimmed,
        ...(assetId ? { assetId } : {}),
        name:
          label ||
          (urls.length > 1
            ? messages.canvas.imageDefaultNameIndexed.replace(
                "{index}",
                String(index + 1),
              )
            : messages.canvas.imageDefaultName),
      });
    }
  }
  return result;
}

/** Stable compare for upstream image lists (zustand equality fn). */
export function canvasUpstreamImagesEqual(
  left: CanvasUpstreamImage[],
  right: CanvasUpstreamImage[],
): boolean {
  if (left === right) {
    return true;
  }
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]!;
    const b = right[index]!;
    if (
      a.url !== b.url ||
      a.assetId !== b.assetId ||
      a.name !== b.name
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Connected prompt/context text that generation will consume, ordered by the
 * edge `order` field.
 */
export function collectCanvasUpstreamPrompt(
  nodes: readonly CanvasFlowNode[],
  edges: readonly CanvasFlowEdge[],
  nodeId: string,
): string {
  const textIds: string[] = [];
  const orders: number[] = [];
  for (const edge of edges) {
    if (edge.target !== nodeId) {
      continue;
    }
    const role = edge.data?.role;
    if (role !== "prompt" && role !== "context") {
      continue;
    }
    textIds.push(edge.source);
    orders.push(edge.data?.order ?? 0);
  }
  if (textIds.length === 0) {
    return "";
  }
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const pairs = textIds
    .map((id, index) => ({
      text: byId.get(id)?.type === "text"
        ? (byId.get(id)?.data.text?.trim() ?? "")
        : "",
      order: orders[index]!,
    }))
    .filter((pair) => pair.text.length > 0)
    .sort((left, right) => left.order - right.order);
  return pairs.map((pair) => pair.text).join("\n\n");
}
