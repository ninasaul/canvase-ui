"use client";

import { memo } from "react";

import type {
  Dispatch,
  RefObject,
  SetStateAction,
} from "react";

import { Panel } from "@xyflow/react";

import type { CanvasPreferences } from "@/lib/canvas/canvas-preferences";
import type { CanvasAutoLayoutMode } from "@/lib/canvas/canvas-auto-layout";
import type { CanvasTasksTab } from "@/components/canvas/canvas-running-tasks";

import type { CanvasSettingsTab } from "../lib/constants";
import {
  ArrowUUpLeft,
  ArrowUUpRight,
  BoundingBox,
  CaretDown,
  Check,
  Cursor,
  FolderPlus,
  GearSix,
  HandGrabbing,
  ImageSquare,
  Images,
  Info,
  Pulse,
  TextT,
  TreeStructure,
  UploadSimple,
  VideoCamera,
  Waveform,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { Icon } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { messages } from "@/messages";


/** Toolbar panel: insert nodes, auto layout, upload, tasks, info and settings. */
function CanvasToolbarInner({
  addAtCenter,
  addGroupAtCenter,
  applyAutoLayout,
  autoLayoutModeLabel,
  history,
  layoutMenuButtonRef,
  layoutMenuOpen,
  openCanvasSettings,
  preferences,
  runningTaskCount,
  selectMode,
  selectedCount,
  setAssetLibraryOpen,
  setGroupName,
  setGroupOpen,
  setLayoutMenuOpen,
  setNodeInfoOpen,
  setPreferences,
  setSelectMode,
  setTasksOpen,
  setTasksTab,
  toolbarPanelPosition,
  toolbarSeparatorClass,
  toolbarUploadProgress,
  toolbarUploadRef,
  toolbarUploading,
  toolbarVertical,
  modLabel,
  shiftLabel,
}: {
  addAtCenter: (type: "text" | "image" | "video" | "audio") => void;
  addGroupAtCenter: () => void;
  applyAutoLayout: (mode: CanvasAutoLayoutMode) => void;
  autoLayoutModeLabel: string;
  history: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean };
  layoutMenuButtonRef: RefObject<HTMLButtonElement | null>;
  layoutMenuOpen: boolean;
  openCanvasSettings: (tab: CanvasSettingsTab) => void;
  preferences: CanvasPreferences;
  runningTaskCount: number;
  selectMode: boolean;
  selectedCount: number;
  setAssetLibraryOpen: Dispatch<SetStateAction<boolean>>;
  setGroupName: Dispatch<SetStateAction<string>>;
  setGroupOpen: Dispatch<SetStateAction<boolean>>;
  setLayoutMenuOpen: Dispatch<SetStateAction<boolean>>;
  setNodeInfoOpen: Dispatch<SetStateAction<boolean>>;
  setPreferences: Dispatch<SetStateAction<CanvasPreferences>>;
  setSelectMode: Dispatch<SetStateAction<boolean>>;
  setTasksOpen: Dispatch<SetStateAction<boolean>>;
  setTasksTab: Dispatch<SetStateAction<CanvasTasksTab>>;
  toolbarPanelPosition: "center-left" | "center-right" | "bottom-center";
  toolbarSeparatorClass: string;
  toolbarUploadProgress: number;
  toolbarUploadRef: RefObject<HTMLInputElement | null>;
  toolbarUploading: boolean;
  toolbarVertical: boolean;
  modLabel: string;
  shiftLabel: string;
}) {
  return (
    <Panel position={toolbarPanelPosition} className="!m-3">
      <div className={`nodrag relative flex items-center gap-1 rounded-lg border border-zinc-200 bg-white/95 p-1 shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95 ${
        toolbarVertical
          ? "max-h-[calc(100vh-2rem)] flex-col overflow-y-auto"
          : "max-w-[calc(100vw-2rem)] overflow-x-auto"
      }`}>
        <Tooltip
          content={`${
            selectMode
              ? messages.canvas.selectMode
              : messages.canvas.moveMode
          } · V / H`}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            className={
              selectMode
                ? "bg-white text-zinc-900 shadow-sm hover:bg-white dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-700"
                : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }
            aria-label={
              selectMode
                ? messages.canvas.selectMode
                : messages.canvas.moveMode
            }
            aria-pressed={selectMode}
            onClick={() => setSelectMode((value) => !value)}
          >
            <Icon
              icon={selectMode ? Cursor : HandGrabbing}
              size={14}
            />
          </Button>
        </Tooltip>
        <Tooltip content={`${messages.canvas.groupSelection} · G`}>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={selectedCount < 2}
            aria-label={messages.canvas.groupSelection}
            onClick={() => {
              if (selectedCount < 2) {
                return;
              }
              setGroupName(
                `${messages.canvas.groupDefault} ${selectedCount}`,
              );
              setGroupOpen(true);
            }}
          >
            <Icon icon={BoundingBox} size={14} />
          </Button>
        </Tooltip>
        <div className={toolbarSeparatorClass} />
        <Tooltip content={`${messages.canvas.addText} · T`}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={messages.canvas.addText}
            onClick={() => addAtCenter("text")}
          >
            <Icon icon={TextT} size={14} />
          </Button>
        </Tooltip>
        <Tooltip content={`${messages.canvas.addImage} · I`}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={messages.canvas.addImage}
            onClick={() => addAtCenter("image")}
          >
            <Icon icon={ImageSquare} size={14} />
          </Button>
        </Tooltip>
        <Tooltip content={`${messages.canvas.addVideo} · M`}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={messages.canvas.addVideo}
            onClick={() => addAtCenter("video")}
          >
            <Icon icon={VideoCamera} size={14} />
          </Button>
        </Tooltip>
        <Tooltip content={`${messages.canvas.addAudio} · A`}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={messages.canvas.addAudio}
            onClick={() => addAtCenter("audio")}
          >
            <Icon icon={Waveform} size={14} />
          </Button>
        </Tooltip>
        <Tooltip content={`${messages.canvas.addGroup} · ${shiftLabel}G`}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={messages.canvas.addGroup}
            onClick={addGroupAtCenter}
          >
            <Icon icon={FolderPlus} size={14} />
          </Button>
        </Tooltip>
        <div className={toolbarSeparatorClass} />
        <Tooltip
          content={
            toolbarUploading
              ? `${messages.canvas.uploadToolbar} · ${toolbarUploadProgress}%`
              : messages.canvas.uploadToolbar
          }
        >
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={toolbarUploading}
            aria-label={messages.canvas.uploadToolbar}
            onClick={() => toolbarUploadRef.current?.click()}
          >
            {toolbarUploading ? (
              <span className="tabular-nums text-[9px] font-medium text-sky-600 dark:text-sky-300">
                {toolbarUploadProgress}%
              </span>
            ) : (
              <Icon icon={UploadSimple} size={14} />
            )}
          </Button>
        </Tooltip>
        <Tooltip content={messages.canvas.assetLibrary}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={messages.canvas.assetLibrary}
            onClick={() => setAssetLibraryOpen(true)}
          >
            <Icon icon={Images} size={14} />
          </Button>
        </Tooltip>
        <div className={toolbarSeparatorClass} />
        <Tooltip content={`${messages.canvas.undo} · ${modLabel}Z`}>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!history.canUndo}
            aria-label={messages.canvas.undo}
            onClick={history.undo}
          >
            <Icon icon={ArrowUUpLeft} size={14} />
          </Button>
        </Tooltip>
        <Tooltip content={`${messages.canvas.redo} · ${modLabel}${shiftLabel}Z`}>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!history.canRedo}
            aria-label={messages.canvas.redo}
            onClick={history.redo}
          >
            <Icon icon={ArrowUUpRight} size={14} />
          </Button>
        </Tooltip>
        <div className={toolbarSeparatorClass} />
        <Tooltip content={`${messages.canvas.autoLayout} · ${autoLayoutModeLabel}`}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={messages.canvas.autoLayout}
            onClick={() => applyAutoLayout(preferences.autoLayoutMode)}
          >
            <Icon icon={TreeStructure} size={14} />
          </Button>
        </Tooltip>
        <Tooltip content={messages.canvas.chooseLayout}>
          <Button
            ref={layoutMenuButtonRef}
            variant="ghost"
            size="icon-sm"
            aria-label={messages.canvas.chooseLayout}
            aria-expanded={layoutMenuOpen}
            onClick={() => setLayoutMenuOpen((open) => !open)}
          >
            <Icon icon={CaretDown} size={12} />
          </Button>
        </Tooltip>
        <Popover
          open={layoutMenuOpen}
          onOpenChange={setLayoutMenuOpen}
          anchorRef={layoutMenuButtonRef}
          placement="top"
          role="menu"
          ariaLabel={messages.canvas.autoLayoutMode}
          minWidth={220}
          className="p-1"
        >
          <div className="space-y-0.5">
            {(
              [
                ["layered-lr", messages.canvas.autoLayoutLayeredLr],
                ["layered-tb", messages.canvas.autoLayoutLayeredTb],
                ["grid", messages.canvas.autoLayoutGrid],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={preferences.autoLayoutMode === value}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                  preferences.autoLayoutMode === value
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                }`}
                onClick={() => {
                  setPreferences({
                    ...preferences,
                    autoLayoutMode: value,
                  });
                  applyAutoLayout(value);
                  setLayoutMenuOpen(false);
                }}
              >
                <span>{label}</span>
                {preferences.autoLayoutMode === value ? (
                  <Icon icon={Check} size={12} />
                ) : null}
              </button>
            ))}
          </div>
        </Popover>
        <div className={toolbarSeparatorClass} />
        <Tooltip content={messages.canvas.runningTasks}>
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative"
            aria-label={messages.canvas.runningTasks}
            onClick={() => {
              setTasksTab("running");
              setTasksOpen(true);
            }}
          >
            <Icon icon={Pulse} size={14} />
            {runningTaskCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-sky-500 px-0.5 text-[8px] font-semibold leading-none text-white">
                {runningTaskCount}
              </span>
            ) : null}
          </Button>
        </Tooltip>
        <Tooltip content={messages.canvas.nodeInfo}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={messages.canvas.nodeInfo}
            onClick={() => setNodeInfoOpen(true)}
          >
            <Icon icon={Info} size={14} />
          </Button>
        </Tooltip>
        <Tooltip content={messages.canvas.canvasSettings}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={messages.canvas.canvasSettings}
            onClick={() => openCanvasSettings("canvas")}
          >
            <Icon icon={GearSix} size={14} />
          </Button>
        </Tooltip>
      </div>
    </Panel>
  );
}

export const CanvasToolbar = memo(CanvasToolbarInner);
