"use client";

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { ReactFlowInstance } from "@xyflow/react";

import type { CanvasFlowNode } from "@/lib/canvas/canvas-store";
import { messages } from "@/messages";

type InsertMenuState = {
  left: number;
  top: number;
  flow: { x: number; y: number };
};

/**
 * Global keyboard map for the canvas: mode switches, grouping, undo/redo,
 * save, refresh, Agent toggle and zoom. Space-to-pan is separate so it can
 * stay mounted while the main map changes.
 */
export function useCanvasShortcuts(input: {
  addAtCenter: (type: "text" | "image" | "video" | "audio") => void;
  addGroupAtCenter: () => void;
  flushSaveRef: MutableRefObject<() => Promise<void>>;
  clearSelection: () => void;
  configNodeId: string | null;
  duplicateNode: (nodeId: string) => void;
  fitView: ReactFlowInstance["fitView"];
  history: { undo: () => void; redo: () => void };
  insertMenu: InsertMenuState | null;
  nodes: CanvasFlowNode[];
  refreshCanvas: () => void;
  selectedNodes: CanvasFlowNode[];
  selectAll: () => void;
  selectMode: boolean;
  zoomTo: ReactFlowInstance["zoomTo"];
  zoomIn: ReactFlowInstance["zoomIn"];
  zoomOut: ReactFlowInstance["zoomOut"];
  setAgentChatOpen: Dispatch<SetStateAction<boolean>>;
  setConfigNodeId: Dispatch<SetStateAction<string | null>>;
  setGroupName: Dispatch<SetStateAction<string>>;
  setGroupOpen: Dispatch<SetStateAction<boolean>>;
  setInsertMenu: Dispatch<SetStateAction<InsertMenuState | null>>;
  setLayoutMenuOpen: Dispatch<SetStateAction<boolean>>;
  setSelectMode: Dispatch<SetStateAction<boolean>>;
  setSpacePressed: Dispatch<SetStateAction<boolean>>;
  setViewportLocked: Dispatch<SetStateAction<boolean>>;
}) {
  const {
    addAtCenter,
    addGroupAtCenter,
    flushSaveRef,
    clearSelection,
    configNodeId,
    duplicateNode,
    setViewportLocked,
    fitView,
    history,
    insertMenu,
    nodes,
    refreshCanvas,
    selectedNodes,
    selectAll,
    selectMode,
    setAgentChatOpen,
    setConfigNodeId,
    setGroupName,
    setGroupOpen,
    setInsertMenu,
    setLayoutMenuOpen,
    setSelectMode,
    zoomTo,
    zoomIn,
    zoomOut,
    setSpacePressed,  } = input;

  // Space-to-pan: separate listener so it survives shortcut map changes.
  useEffect(() => {
    function onSpaceDown(event: KeyboardEvent) {
      if (event.code !== "Space" || event.repeat) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(
          "input, textarea, select, [contenteditable='true'], [role='dialog']",
        )
      ) {
        return;
      }
      setSpacePressed(true);
    }
    function onSpaceUp(event: KeyboardEvent) {
      if (event.code === "Space") {
        setSpacePressed(false);
      }
    }
    function onBlur() {
      setSpacePressed(false);
    }
    window.addEventListener("keydown", onSpaceDown);
    window.addEventListener("keyup", onSpaceUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onSpaceDown);
      window.removeEventListener("keyup", onSpaceUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [setSpacePressed]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      // Toggle Agent even while typing in the chat composer (Cmd/Ctrl+\).
      if (mod && key === "\\" && !event.altKey && !event.shiftKey) {
        if (!document.querySelector('[role="dialog"]')) {
          event.preventDefault();
          setAgentChatOpen((current) => !current);
        }
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"]')) {
        return;
      }

      if (insertMenu && key !== "escape") {
        return;
      }

      if (mod) {
        if (key === "z") {
          event.preventDefault();
          if (event.shiftKey) {
            history.redo();
          } else {
            history.undo();
          }
          return;
        }
        if (key === "y") {
          event.preventDefault();
          history.redo();
          return;
        }
        if (key === "d") {
          event.preventDefault();
          for (const node of nodes.filter((item) => item.selected)) {
            duplicateNode(node.id);
          }
          return;
        }
        if (key === "a") {
          event.preventDefault();
          selectAll();
          return;
        }
        if (key === "s") {
          event.preventDefault();
          void flushSaveRef.current();
        }
        return;
      }

      if (event.altKey || event.repeat) {
        return;
      }

      if (event.shiftKey && key === "g") {
        event.preventDefault();
        addGroupAtCenter();
        return;
      }

      if (event.shiftKey && key === "r") {
        event.preventDefault();
        refreshCanvas();
        return;
      }

      switch (key) {
        case "t":
          event.preventDefault();
          addAtCenter("text");
          return;
        case "i":
          event.preventDefault();
          addAtCenter("image");
          return;
        case "m":
          event.preventDefault();
          addAtCenter("video");
          return;
        case "a":
          event.preventDefault();
          addAtCenter("audio");
          return;
        case "h":
          event.preventDefault();
          setSelectMode(false);
          setViewportLocked(false);
          return;
        case "v":
          event.preventDefault();
          setSelectMode((value) => !value);
          return;
        case "g":
          if (selectedNodes.length >= 2) {
            event.preventDefault();
            setGroupName(
              `${messages.canvas.groupDefault} ${selectedNodes.length}`,
            );
            setGroupOpen(true);
          }
          return;
        case "f":
          event.preventDefault();
          void fitView({ padding: 0.2, duration: 250 });
          return;
        case "l":
          event.preventDefault();
          setViewportLocked((locked) => !locked);
          return;
        case "escape":
          if (insertMenu) {
            event.preventDefault();
            setInsertMenu(null);
          } else if (configNodeId) {
            event.preventDefault();
            setConfigNodeId(null);
          } else if (selectMode) {
            event.preventDefault();
            setSelectMode(false);
          } else {
            clearSelection();
            setLayoutMenuOpen(false);
          }
          return;
        case "1":
          event.preventDefault();
          void zoomTo(1, { duration: 150 });
          return;
        case "+":
        case "=":
          event.preventDefault();
          void zoomIn({ duration: 150 });
          return;
        case "-":
          event.preventDefault();
          void zoomOut({ duration: 150 });
          return;
        default:
          return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    addAtCenter,
    addGroupAtCenter,
    flushSaveRef,
    clearSelection,
    configNodeId,
    duplicateNode,
    setViewportLocked,
    fitView,
    history,
    insertMenu,
    nodes,
    refreshCanvas,
    selectedNodes,
    selectAll,
    selectMode,
    setAgentChatOpen,
    setConfigNodeId,
    setGroupName,
    setGroupOpen,
    setInsertMenu,
    setLayoutMenuOpen,
    setSelectMode,
    zoomTo,
    zoomIn,
    zoomOut,
  ]);
}
