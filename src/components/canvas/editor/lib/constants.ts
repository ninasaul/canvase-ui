import { CANVAS_EDGE_COLORS } from "@/lib/canvas/canvas-preferences";
import { messages } from "@/messages";

export type CanvasSettingsTab = "canvas" | "generation" | "storage";

export const NODE_TYPE_COLORS: Record<string, string> = {
  text: "#3b82f6",
  image: "#10b981",
  video: "#8b5cf6",
  audio: "#f97316",
  group: "#94a3b8",
};

export const CANVAS_MIN_ZOOM = 0.05;
export const CANVAS_MAX_ZOOM = 4;
export const CANVAS_SNAP_DISTANCE = 40;
export const CANVAS_CONNECTION_SNAP_RADIUS = 96;
export const CANVAS_DEFAULT_ZOOM = 0.8;
export const CANVAS_DEFAULT_VIEWPORT = {
  x: 0,
  y: 0,
  zoom: CANVAS_DEFAULT_ZOOM,
};

/** Below this zoom node media is illegible, so it is not mounted. */
export const CANVAS_LOD_ZOOM = 0.35;

/**
 * Level of detail for nodes (simplified content below CANVAS_LOD_ZOOM).
 * Required at scale: rendering full node content for 100+ nodes makes panning
 * unusable once zoomed out. The switch only flips once per threshold crossing
 * (hysteresis in useCanvasViewport), so the one-off re-render is acceptable.
 */
export const CANVAS_LOD_ENABLED = true;
/** Edge role labels only mount when they can actually be read. */
export const CANVAS_EDGE_LABEL_ZOOM = 0.5;
/** Animated edges repaint every frame; past this many the canvas crawls. */
export const CANVAS_ANIMATED_EDGE_LIMIT = 80;

export const CANVAS_DEFAULT_FIT_VIEW_OPTIONS = {
  minZoom: CANVAS_MIN_ZOOM,
  maxZoom: CANVAS_DEFAULT_ZOOM,
  padding: 0.2,
};

export const CANVAS_BACKGROUND_PATTERN_COLORS = {
  light: {
    dots: "#d4d4d8",
    lines: "#ececee",
    cross: "#d4d4d8",
    none: "transparent",
  },
  dark: {
    dots: "rgba(255,255,255,0.18)",
    lines: "rgba(255,255,255,0.075)",
    cross: "rgba(255,255,255,0.16)",
    none: "transparent",
  },
} as const;

export const EDGE_COLOR_OPTIONS = [
  {
    value: "muted" as const,
    label: messages.canvas.edgeColorMuted,
    color: CANVAS_EDGE_COLORS.muted,
  },
  {
    value: "blue" as const,
    label: messages.canvas.edgeColorBlue,
    color: CANVAS_EDGE_COLORS.blue,
  },
  {
    value: "green" as const,
    label: messages.canvas.edgeColorGreen,
    color: CANVAS_EDGE_COLORS.green,
  },
  {
    value: "violet" as const,
    label: messages.canvas.edgeColorViolet,
    color: CANVAS_EDGE_COLORS.violet,
  },
  {
    value: "orange" as const,
    label: messages.canvas.edgeColorOrange,
    color: CANVAS_EDGE_COLORS.orange,
  },
  {
    value: "red" as const,
    label: messages.canvas.edgeColorRed,
    color: CANVAS_EDGE_COLORS.red,
  },
  {
    value: "cyan" as const,
    label: messages.canvas.edgeColorCyan,
    color: CANVAS_EDGE_COLORS.cyan,
  },
  {
    value: "pink" as const,
    label: messages.canvas.edgeColorPink,
    color: CANVAS_EDGE_COLORS.pink,
  },
];
