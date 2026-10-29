"use client";

import type {
  CanvasEdgeRole,
  CanvasGraph,
  CanvasGraphEdge,
  CanvasGraphNode,
  CanvasNodeData,
  CanvasNodeType,
} from "@/lib/tu-shared-browser";

export const canvasTemplateKeys = [
  "blank",
  "text-to-image",
  "image-to-video",
  "multi-reference",
] as const;

export type CanvasTemplateKey = (typeof canvasTemplateKeys)[number];

const nodeSize: Record<CanvasNodeType, { width: number; height: number }> = {
  text: { width: 220, height: 120 },
  image: { width: 240, height: 242 },
  video: { width: 280, height: 160 },
  audio: { width: 220, height: 120 },
  group: { width: 360, height: 280 },
};

function node(
  type: CanvasNodeType,
  x: number,
  y: number,
  data: CanvasNodeData = {},
): CanvasGraphNode {
  const size = nodeSize[type];
  return {
    id: `${type}_${crypto.randomUUID()}`,
    type,
    position: { x, y },
    width: size.width,
    height: size.height,
    data,
  };
}

function edge(
  source: CanvasGraphNode,
  target: CanvasGraphNode,
  role: CanvasEdgeRole,
  order = 0,
): CanvasGraphEdge {
  return {
    id: `edge_${crypto.randomUUID()}`,
    source: source.id,
    target: target.id,
    sourceHandle: "out",
    targetHandle: role,
    data: { role, order },
  };
}

function graph(
  nodes: CanvasGraphNode[],
  edges: CanvasGraphEdge[] = [],
): CanvasGraph {
  return {
    schemaVersion: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes,
    edges,
  };
}

export function createCanvasTemplateGraph(key: CanvasTemplateKey): CanvasGraph {
  if (key === "blank") {
    return graph([]);
  }

  if (key === "text-to-image") {
    const text = node("text", 40, 120);
    const image = node("image", 360, 40, {
      params: { size: "1024x1024", aspectRatio: "1:1" },
    });
    return graph([text, image], [edge(text, image, "prompt")]);
  }

  if (key === "image-to-video") {
    const image = node("image", 20, 80, {
      params: { size: "1024x1024", aspectRatio: "1:1" },
    });
    const text = node("text", 20, 440);
    const video = node("video", 400, 120, {
      params: { ratio: "16:9", duration: "5" },
    });
    return graph(
      [image, text, video],
      [
        edge(text, video, "prompt"),
        edge(image, video, "first_frame"),
      ],
    );
  }

  const text = node("text", 20, 40);
  const imageA = node("image", 20, 280, {
    params: { size: "1024x1024", aspectRatio: "1:1" },
  });
  const imageB = node("image", 360, 280, {
    params: { size: "1024x1024", aspectRatio: "1:1" },
  });
  const video = node("video", 720, 280, {
    params: { ratio: "16:9", duration: "5" },
  });
  return graph(
    [text, imageA, imageB, video],
    [
      edge(text, video, "prompt"),
      edge(imageA, video, "reference_image", 0),
      edge(imageB, video, "reference_image", 1),
    ],
  );
}
