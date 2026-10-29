"use client";

import { useMemo } from "react";
import { useCanvasStore } from "./canvas-store";

/** Connected prompt/context text that generation will consume. */
export function useCanvasUpstreamPrompt(nodeId: string): string {
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  return useMemo(() => {
    const textById = new Map(
      nodes
        .filter((node) => node.type === "text")
        .map((node) => [node.id, node.data.text?.trim() ?? ""]),
    );
    return edges
      .filter(
        (edge) =>
          edge.target === nodeId &&
          (edge.data?.role === "prompt" || edge.data?.role === "context"),
      )
      .sort(
        (left, right) =>
          (left.data?.order ?? 0) - (right.data?.order ?? 0),
      )
      .map((edge) => textById.get(edge.source) ?? "")
      .filter(Boolean)
      .join("\n\n");
  }, [edges, nodeId, nodes]);
}
