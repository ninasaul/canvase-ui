"use client";

import { memo } from "react";

import { CanvasConnectAgentModal } from "@/components/canvas/canvas-connect-agent-modal";
import { CanvasInfoModal } from "@/components/canvas/editor/panels/canvas-info-modal";
import { CanvasGroupModal } from "@/components/canvas/editor/panels/canvas-group-modal";
import { CanvasModelSettingsModal } from "@/components/canvas/canvas-model-settings-modal";
import { CanvasNodeInfoModal } from "@/components/canvas/editor/panels/canvas-node-info-modal";
import { CanvasSettingsModal } from "@/components/canvas/editor/panels/canvas-settings-modal";
import type { CanvasDetail } from "@/lib/canvas/canvas-api";
import type { CanvasFlowNode } from "@/lib/canvas/canvas-store";
import type {
} from "@/lib/canvas/canvas-store";
import type { PortalPublicModel } from "@/types/admin";

import type { useCanvasSettings } from "../workspace/use-canvas-settings";

type SettingsState = ReturnType<typeof useCanvasSettings>;

/** Dialogs that hang off the canvas document: info, models, agent, settings. */
function CanvasOverlaysInner({
  infoOpen,
  titleDraft,
  setTitleDraft,
  thumbnailUrl,
  thumbnailBusy,
  thumbnailRef,
  nodeCount,
  edgeCount,
  canvasDocument,
  savedAt,
  exportJson,
  saveCanvasInfo,
  closeCanvasInfo,
  modelSettingsOpen,
  setModelSettingsOpen,
  setByokRevision,
  connectAgentOpen,
  setConnectAgentOpen,
  setAgentTokenActive,
  canvasSettings,
  chatModels,
  imageModels,
  videoModels,
  imageDefaultParams,
  videoDefaultParams,
  nodeInfoOpen,
  setNodeInfoOpen,
  groupOpen,
  groupName,
  setGroupName,
  setGroupOpen,
  groupSelection,
  selectedNodes,
  nodeInfoNodes,
  onOpenAgentChat,
}: {
  infoOpen: boolean;
  titleDraft: string;
  setTitleDraft: (value: string) => void;
  thumbnailUrl: string | null;
  thumbnailBusy: boolean;
  thumbnailRef: { current: HTMLInputElement | null };
  nodeCount: number;
  edgeCount: number;
  canvasDocument: CanvasDetail;
  savedAt: string | null;
  exportJson: () => void;
  saveCanvasInfo: () => void;
  closeCanvasInfo: () => void;
  modelSettingsOpen: boolean;
  setModelSettingsOpen: (value: boolean) => void;
  setByokRevision: (update: (current: number) => number) => void;
  connectAgentOpen: boolean;
  setConnectAgentOpen: (value: boolean) => void;
  setAgentTokenActive: (value: boolean) => void;
  canvasSettings: SettingsState;
  chatModels: PortalPublicModel[];
  imageModels: PortalPublicModel[];
  videoModels: PortalPublicModel[];
  imageDefaultParams: Record<string, unknown>;
  videoDefaultParams: Record<string, unknown>;
  nodeInfoOpen: boolean;
  setNodeInfoOpen: (value: boolean) => void;
  groupOpen: boolean;
  groupName: string;
  setGroupName: (value: string) => void;
  setGroupOpen: (value: boolean) => void;
  groupSelection: (nodeIds: string[], name: string) => void;
  selectedNodes: CanvasFlowNode[];
  nodeInfoNodes: CanvasFlowNode[];
  onOpenAgentChat?: () => void;
}) {
  return (
    <>
      <CanvasInfoModal
        open={infoOpen}
        titleDraft={titleDraft}
        onTitleChange={setTitleDraft}
        thumbnailUrl={thumbnailUrl}
        thumbnailBusy={thumbnailBusy}
        onPickThumbnail={() => thumbnailRef.current?.click()}
        nodeCount={nodeCount}
        edgeCount={edgeCount}
        createdAt={canvasDocument.createdAt}
        updatedAt={savedAt ?? canvasDocument.updatedAt}
        onExport={exportJson}
        onSubmit={saveCanvasInfo}
        onClose={closeCanvasInfo}
      />

      <CanvasModelSettingsModal
        open={modelSettingsOpen}
        onClose={() => setModelSettingsOpen(false)}
        onSaved={() => setByokRevision((current) => current + 1)}
      />

      <CanvasConnectAgentModal
        open={connectAgentOpen}
        canvasId={canvasDocument.id}
        onClose={() => setConnectAgentOpen(false)}
        onTokensChanged={setAgentTokenActive}
      />

      <CanvasSettingsModal
        state={canvasSettings}
        chatModels={chatModels}
        imageModels={imageModels}
        videoModels={videoModels}
        imageDefaultParams={imageDefaultParams}
        videoDefaultParams={videoDefaultParams}
        onOpenAgentChat={onOpenAgentChat}
      />
      <CanvasNodeInfoModal
        open={nodeInfoOpen}
        nodes={nodeInfoNodes}
        onClose={() => setNodeInfoOpen(false)}
      />

      <CanvasGroupModal
        open={groupOpen}
        name={groupName}
        onNameChange={setGroupName}
        onClose={() => setGroupOpen(false)}
        onCreate={() => {
          groupSelection(
            selectedNodes.map((node) => node.id),
            groupName,
          );
          setGroupOpen(false);
        }}
      />
    </>
  );
}

export const CanvasOverlays = memo(CanvasOverlaysInner);

/**
 * Stable identity for "no nodes to show": passing a fresh `[]` while the node
 * info dialog is closed would defeat memo on every render.
 */
export const EMPTY_NODES: CanvasFlowNode[] = [];
