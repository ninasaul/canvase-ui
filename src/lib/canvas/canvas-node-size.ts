import type {
  CanvasNodeData,
  CanvasNodeType,
} from "@/lib/tu-shared-browser";

/** Preview width for media nodes; height is derived from the selected ratio. */
export const CANVAS_MEDIA_NODE_WIDTH = {
  image: 240,
  video: 280,
} as const;

const MEDIA_NODE_CHROME_HEIGHT = 2; // card borders only; titles render above the node
const MIN_CONTENT_HEIGHT = 120;
const MAX_CONTENT_HEIGHT = 560;

const COLON_RATIO = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/;
const PIXEL_SIZE = /^(\d+)x(\d+)$/i;

function ratioValue(ratio: string | undefined): number | null {
  const trimmed = ratio?.trim();
  if (!trimmed || trimmed === "adaptive" || trimmed === "auto") {
    return null;
  }
  const match = COLON_RATIO.exec(trimmed);
  if (!match) {
    return null;
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) {
    return null;
  }
  return width / height;
}

function pixelRatio(size: string | undefined): number | null {
  const match = PIXEL_SIZE.exec(size?.trim() ?? "");
  if (!match) {
    return null;
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width && height ? width / height : null;
}

export function imageAspectRatio(
  params: Partial<{ size: string; aspectRatio: string }> | undefined,
): number {
  const size = params?.size?.trim() ?? "";
  const sizeRatio = ratioValue(size) ?? pixelRatio(size);
  if (sizeRatio) {
    return sizeRatio;
  }
  return ratioValue(params?.aspectRatio) ?? 1;
}

export function videoAspectRatio(
  params: Partial<{ ratio: string }> | undefined,
): number {
  return ratioValue(params?.ratio) ?? 16 / 9;
}

export function canvasMediaNodeSize(
  type: "image" | "video",
  ratio: number,
): { width: number; height: number } {
  const width = CANVAS_MEDIA_NODE_WIDTH[type];
  const contentHeight = Math.min(
    MAX_CONTENT_HEIGHT,
    Math.max(MIN_CONTENT_HEIGHT, width / Math.max(ratio, 0.01)),
  );
  return {
    width,
    height: Math.round(contentHeight + MEDIA_NODE_CHROME_HEIGHT),
  };
}

/** Node size for a stored media node, based on its generation params. */
export function canvasNodeSizeFromData(
  type: CanvasNodeType,
  data: CanvasNodeData,
): { width: number; height: number } | null {
  if (type === "image") {
    return canvasMediaNodeSize(
      "image",
      imageAspectRatio(
        data.params as Partial<{ size: string; aspectRatio: string }> | undefined,
      ),
    );
  }
  if (type === "video") {
    return canvasMediaNodeSize(
      "video",
      videoAspectRatio(
        data.params as Partial<{ ratio: string }> | undefined,
      ),
    );
  }
  return null;
}
