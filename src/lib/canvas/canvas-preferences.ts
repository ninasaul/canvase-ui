"use client";

import type { CanvasAutoLayoutMode } from "./canvas-auto-layout";

export type CanvasBackgroundKind = "dots" | "lines" | "cross" | "none";
export type CanvasEdgeKind = "smoothstep" | "bezier" | "straight";
export type CanvasEdgeColor =
  | "muted"
  | "blue"
  | "green"
  | "violet"
  | "orange"
  | "red"
  | "cyan"
  | "pink";
export type CanvasEdgeLineStyle = "solid" | "dashed" | "dotted";
export type CanvasDockPlacement = "canvas" | "node";
export type CanvasNodeStyle = "card" | "soft" | "outline" | "glass";
export type CanvasHandleStyle = "plus" | "dot" | "ring" | "arrow";
export type CanvasToolbarPosition = "left" | "right" | "bottom";

export const CANVAS_EDGE_COLORS: Record<CanvasEdgeColor, string> = {
  muted: "#a1a1aa",
  blue: "#3b82f6",
  green: "#10b981",
  violet: "#8b5cf6",
  orange: "#f97316",
  red: "#ef4444",
  cyan: "#06b6d4",
  pink: "#ec4899",
};

export function canvasEdgeDashArray(style: CanvasEdgeLineStyle): string | undefined {
  if (style === "dashed") {
    return "6 4";
  }
  if (style === "dotted") {
    return "2 4";
  }
  return undefined;
}

export type CanvasPreferences = {
  background: CanvasBackgroundKind;
  backgroundGap: number;
  showMiniMap: boolean;
  audioPlayerBorder: boolean;
  nodeResizeEnabled: boolean;
  generationDockPlacement: CanvasDockPlacement;
  autoLayoutMode: CanvasAutoLayoutMode;
  edgeType: CanvasEdgeKind;
  edgeColor: CanvasEdgeColor;
  edgeWidth: number;
  edgeLineStyle: CanvasEdgeLineStyle;
  animateEdges: boolean;
  snapToGrid: boolean;
  showHelperLines: boolean;
  autoConnect: boolean;
  nodeStyle: CanvasNodeStyle;
  handleStyle: CanvasHandleStyle;
  toolbarPosition: CanvasToolbarPosition;
};

export const DEFAULT_CANVAS_PREFERENCES: CanvasPreferences = {
  background: "lines",
  backgroundGap: 18,
  showMiniMap: true,
  audioPlayerBorder: false,
  nodeResizeEnabled: true,
  generationDockPlacement: "canvas",
  autoLayoutMode: "layered-lr",
  edgeType: "bezier",
  edgeColor: "muted",
  edgeWidth: 1.5,
  edgeLineStyle: "solid",
  animateEdges: true,
  snapToGrid: false,
  showHelperLines: true,
  autoConnect: false,
  nodeStyle: "card",
  handleStyle: "plus",
  toolbarPosition: "bottom",
};

const STORAGE_KEY = "tu.canvas.preferences.v1";
const BACKGROUNDS = new Set<CanvasBackgroundKind>([
  "dots",
  "lines",
  "cross",
  "none",
]);
const GAPS = new Set([12, 18, 24]);
const EDGE_TYPES = new Set<CanvasEdgeKind>(["smoothstep", "bezier", "straight"]);
const EDGE_COLORS = new Set<CanvasEdgeColor>([
  "muted",
  "blue",
  "green",
  "violet",
  "orange",
  "red",
  "cyan",
  "pink",
]);
const EDGE_LINE_STYLES = new Set<CanvasEdgeLineStyle>(["solid", "dashed", "dotted"]);
const NODE_STYLES = new Set<CanvasNodeStyle>(["card", "soft", "outline", "glass"]);
const HANDLE_STYLES = new Set<CanvasHandleStyle>(["plus", "dot", "ring", "arrow"]);
const TOOLBAR_POSITIONS = new Set<CanvasToolbarPosition>([
  "left",
  "right",
  "bottom",
]);
const EDGE_WIDTHS = new Set([0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4]);

export function normalizeCanvasPreferences(
  value: unknown,
): CanvasPreferences {
  const record =
    value !== null && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const background = BACKGROUNDS.has(
    record.background as CanvasBackgroundKind,
  )
    ? (record.background as CanvasBackgroundKind)
    : DEFAULT_CANVAS_PREFERENCES.background;
  const gap = Number(record.backgroundGap);
  return {
    background,
    backgroundGap: GAPS.has(gap)
      ? gap
      : DEFAULT_CANVAS_PREFERENCES.backgroundGap,
    showMiniMap:
      typeof record.showMiniMap === "boolean"
        ? record.showMiniMap
        : DEFAULT_CANVAS_PREFERENCES.showMiniMap,
    audioPlayerBorder:
      typeof record.audioPlayerBorder === "boolean"
        ? record.audioPlayerBorder
        : DEFAULT_CANVAS_PREFERENCES.audioPlayerBorder,
    nodeResizeEnabled:
      typeof record.nodeResizeEnabled === "boolean"
        ? record.nodeResizeEnabled
        : DEFAULT_CANVAS_PREFERENCES.nodeResizeEnabled,
    generationDockPlacement:
      record.generationDockPlacement === "node" ? "node" : "canvas",
    autoLayoutMode:
      record.autoLayoutMode === "layered-tb" || record.autoLayoutMode === "grid"
        ? record.autoLayoutMode
        : "layered-lr",
    edgeType: EDGE_TYPES.has(record.edgeType as CanvasEdgeKind)
      ? (record.edgeType as CanvasEdgeKind)
      : DEFAULT_CANVAS_PREFERENCES.edgeType,
    edgeColor: EDGE_COLORS.has(record.edgeColor as CanvasEdgeColor)
      ? (record.edgeColor as CanvasEdgeColor)
      : DEFAULT_CANVAS_PREFERENCES.edgeColor,
    edgeWidth: EDGE_WIDTHS.has(Number(record.edgeWidth))
      ? Number(record.edgeWidth)
      : DEFAULT_CANVAS_PREFERENCES.edgeWidth,
    edgeLineStyle: EDGE_LINE_STYLES.has(
      record.edgeLineStyle as CanvasEdgeLineStyle,
    )
      ? (record.edgeLineStyle as CanvasEdgeLineStyle)
      : DEFAULT_CANVAS_PREFERENCES.edgeLineStyle,
    animateEdges:
      typeof record.animateEdges === "boolean"
        ? record.animateEdges
        : DEFAULT_CANVAS_PREFERENCES.animateEdges,
    snapToGrid:
      typeof record.snapToGrid === "boolean"
        ? record.snapToGrid
        : DEFAULT_CANVAS_PREFERENCES.snapToGrid,
    showHelperLines:
      typeof record.showHelperLines === "boolean"
        ? record.showHelperLines
        : DEFAULT_CANVAS_PREFERENCES.showHelperLines,
    autoConnect:
      typeof record.autoConnect === "boolean"
        ? record.autoConnect
        : DEFAULT_CANVAS_PREFERENCES.autoConnect,
    nodeStyle: NODE_STYLES.has(record.nodeStyle as CanvasNodeStyle)
      ? (record.nodeStyle as CanvasNodeStyle)
      : DEFAULT_CANVAS_PREFERENCES.nodeStyle,
    handleStyle: HANDLE_STYLES.has(record.handleStyle as CanvasHandleStyle)
      ? (record.handleStyle as CanvasHandleStyle)
      : DEFAULT_CANVAS_PREFERENCES.handleStyle,
    toolbarPosition: TOOLBAR_POSITIONS.has(
      record.toolbarPosition as CanvasToolbarPosition,
    )
      ? (record.toolbarPosition as CanvasToolbarPosition)
      : DEFAULT_CANVAS_PREFERENCES.toolbarPosition,
  };
}

export function loadCanvasPreferences(): CanvasPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_CANVAS_PREFERENCES;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw
      ? normalizeCanvasPreferences(JSON.parse(raw) as unknown)
      : DEFAULT_CANVAS_PREFERENCES;
  } catch {
    return DEFAULT_CANVAS_PREFERENCES;
  }
}

export function saveCanvasPreferences(
  preferences: CanvasPreferences,
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Preferences are best-effort; ignore quota/privacy failures.
  }
}
