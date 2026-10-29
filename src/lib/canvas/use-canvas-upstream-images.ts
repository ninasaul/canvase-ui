"use client";

import { useMemo } from "react";
import { messages } from "@/messages";
import { useCanvasStore } from "./canvas-store";

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

/**
 * Images connected to a generation node, with frame roles ordered before
 * general reference images.
 */
export function useCanvasUpstreamImages(nodeId: string): CanvasUpstreamImage[] {
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  return useMemo(() => {
    const images = new Map(
      nodes
        .filter((node) => node.type === "image")
        .map((node) => [node.id, node]),
    );
    const seen = new Set<string>();
    const result: CanvasUpstreamImage[] = [];
    const incoming = edges
      .filter(
        (edge) =>
          edge.target === nodeId &&
          (edge.data?.role === "reference_image" ||
            edge.data?.role === "first_frame" ||
            edge.data?.role === "last_frame"),
      )
      .sort(
        (left, right) =>
          (ROLE_ORDER[left.data?.role ?? ""] ?? 9) -
            (ROLE_ORDER[right.data?.role ?? ""] ?? 9) ||
          (left.data?.order ?? 0) - (right.data?.order ?? 0),
      );
    for (const edge of incoming) {
      const source = images.get(edge.source);
      if (!source) {
        continue;
      }
      const urls = [
        ...(source.data.urls ?? []),
        source.data.url ?? "",
      ].filter(Boolean);
      for (const [index, url] of urls.entries()) {
        const trimmed = url.trim();
        if (!trimmed || seen.has(trimmed)) {
          continue;
        }
        seen.add(trimmed);
        const assetId =
          source.data.assetIds?.[index] ?? source.data.assetId;
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
  }, [edges, nodeId, nodes]);
}
