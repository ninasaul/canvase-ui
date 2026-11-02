"use client";

import { Panel } from "@xyflow/react";
import {
  BoundingBox,
  CornersOut,
  DotsNine,
  Lock,
  LockOpen,
  MapTrifold,
  Minus,
  Plus,
} from "@phosphor-icons/react";

import { CanvasZoomLabel } from "@/components/canvas/canvas-zoom-label";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { messages } from "@/messages";

/** Bottom-left dock: zoom, fit view, viewport lock, grid snap and minimap. */
export function CanvasBottomDock({
  onZoomIn,
  onZoomOut,
  onFitView,
  viewportLocked,
  onToggleLock,
  snapToGrid,
  onToggleSnap,
  showMiniMap,
  onToggleMiniMap,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  viewportLocked: boolean;
  onToggleLock: () => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  showMiniMap: boolean;
  onToggleMiniMap: () => void;
}) {
  return (
    <Panel position="bottom-left" className="!m-3">
      <div className="nodrag flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-white/95 p-1 shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
          <Tooltip content={`${messages.canvas.zoomOut} · -`}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={messages.canvas.zoomOut}
              onClick={onZoomOut}
            >
              <Icon icon={Minus} size={14} />
            </Button>
          </Tooltip>
          <CanvasZoomLabel />
          <Tooltip content={`${messages.canvas.zoomIn} · +`}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={messages.canvas.zoomIn}
              onClick={onZoomIn}
            >
              <Icon icon={Plus} size={14} />
            </Button>
          </Tooltip>
          <Tooltip content={`${messages.canvas.fitView} · F`}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={messages.canvas.fitView}
              onClick={onFitView}
            >
              <Icon icon={CornersOut} size={14} />
            </Button>
          </Tooltip>
          <Tooltip
            content={`${
              viewportLocked
                ? messages.canvas.unlockViewport
                : messages.canvas.lockViewport
            } · L`}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              className={
                viewportLocked
                  ? "text-sky-600 dark:text-sky-400"
                  : undefined
              }
              aria-label={
                viewportLocked
                  ? messages.canvas.unlockViewport
                  : messages.canvas.lockViewport
              }
              onClick={onToggleLock}
            >
              <Icon
                icon={viewportLocked ? Lock : LockOpen}
                size={14}
              />
            </Button>
          </Tooltip>
          <Tooltip content={messages.canvas.snapToGrid}>
            <Button
              variant="ghost"
              size="icon-sm"
              className={
                snapToGrid
                  ? "text-sky-600 dark:text-sky-400"
                  : undefined
              }
              aria-label={messages.canvas.snapToGrid}
              aria-pressed={snapToGrid}
              onClick={onToggleSnap}
            >
              <Icon
                icon={
                  snapToGrid ? DotsNine : BoundingBox
                }
                size={14}
              />
            </Button>
          </Tooltip>
          <Tooltip
            content={
              showMiniMap
                ? messages.canvas.hideMiniMap
                : messages.canvas.showMiniMap
            }
          >
            <Button
              variant="ghost"
              size="icon-sm"
              className={
                showMiniMap
                  ? "text-sky-600 dark:text-sky-400"
                  : undefined
              }
              aria-label={
                showMiniMap
                  ? messages.canvas.hideMiniMap
                  : messages.canvas.showMiniMap
              }
              aria-pressed={showMiniMap}
              onClick={onToggleMiniMap}
            >
              <Icon icon={MapTrifold} size={14} />
            </Button>
          </Tooltip>
      </div>
    </Panel>  );
}
