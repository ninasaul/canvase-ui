"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PlaygroundMediaParamPill } from "@/components/playground/playground-media-param-pill";
import { PlaygroundModelSelect } from "@/components/playground/playground-model-select";
import { PLAYGROUND_COMPOSER_TOOLBAR_LEADING_CLASS } from "@/components/playground/playground-styles";
import { PlaygroundVideoComposer } from "@/components/playground/playground-video-composer";
import { PlaygroundVideoSettings } from "@/components/playground/playground-video-settings";
import { CanvasGenerationCost } from "./canvas-generation-cost";
import { useCanvasUpstreamPrompt } from "@/lib/canvas/use-canvas-upstream-prompt";
import { useCanvasUpstreamImages } from "@/lib/canvas/use-canvas-upstream-images";
import { useCanvasStore } from "@/lib/canvas/canvas-store";
import {
  canvasMediaNodeSize,
  videoAspectRatio,
} from "@/lib/canvas/canvas-node-size";
import {
  createMediaUrlReference,
  type PlaygroundMediaReference,
  type VideoReferenceMode,
} from "@/lib/playground/media-references";
import { buildVideoParamSummary } from "@/lib/playground/media-param-summary";
import type { ModelIdentity } from "@canvase/generation-params/model-families";
import {
  DEFAULT_VIDEO_PARAMS,
  getVideoCapabilityProfile,
  resolveVideoSanitizeMediaFlags,
  sanitizeVideoParams,
  type PlaygroundVideoParams,
} from "@canvase/generation-params/video";
import { messages } from "@/messages";
import type { PortalPublicModel } from "@/types/admin";
import type { CanvasMediaReference } from "@/lib/tu-shared-browser";
import { CANVAS_GENERATION_BOTTOM_SURFACE_CLASS } from "@/components/playground/playground-styles";
import { useCanvasActions } from "./canvas-actions";

function toModelIdentity(model: PortalPublicModel | undefined): ModelIdentity {
  if (!model) {
    return { id: "" };
  }
  return {
    id: model.id,
    vendor: model.vendor,
    display_name: model.display_name,
  };
}

function toPlaygroundReference(
  reference: CanvasMediaReference,
  index: number,
): PlaygroundMediaReference {
  return createMediaUrlReference(
    reference.url,
    reference.mediaType,
    index,
    reference.name,
    reference.assetId,
  );
}

export function CanvasVideoGenerationDock({
  nodeId,
  embedded = false,
}: {
  nodeId: string;
  onClose?: () => void;
  embedded?: boolean;
}) {
  const { models, runNode } = useCanvasActions();
  const node = useCanvasStore((state) =>
    state.nodes.find((item) => item.id === nodeId),
  );
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const setNodeSize = useCanvasStore((state) => state.setNodeSize);

  const data = node?.data;
  const storedReferences = (data?.references as CanvasMediaReference[] | undefined) ?? [];
  const [model, setModel] = useState(data?.model ?? "");
  const upstreamPrompt = useCanvasUpstreamPrompt(nodeId);
  const [prompt, setPrompt] = useState(data?.prompt || upstreamPrompt);
  const promptEditedRef = useRef(Boolean(data?.prompt?.trim()));
  const [params, setParams] = useState<PlaygroundVideoParams>(() => ({
    ...DEFAULT_VIDEO_PARAMS,
    ...((data?.params as Partial<PlaygroundVideoParams> | undefined) ?? {}),
  }));
  const upstreamImages = useCanvasUpstreamImages(nodeId);
  const upstreamReferences = useMemo(
    () =>
      upstreamImages.map((item, index) =>
        createMediaUrlReference(
          item.url,
          "image",
          index,
          item.name,
          item.assetId,
        ),
      ),
    [upstreamImages],
  );
  const [manualReferences, setManualReferences] = useState<
    PlaygroundMediaReference[]
  >(() => {
    const connectedUrls = new Set(upstreamReferences.map((item) => item.url));
    return storedReferences
      .map(toPlaygroundReference)
      .filter((item) => !item.url || !connectedUrls.has(item.url));
  });
  const references = useMemo(() => {
    const seen = new Set<string>();
    return [...upstreamReferences, ...manualReferences].filter((item) => {
      const url = item.url?.trim();
      if (!url || seen.has(url)) {
        return false;
      }
      seen.add(url);
      return true;
    });
  }, [manualReferences, upstreamReferences]);

  useEffect(() => {
    if (!promptEditedRef.current) {
      setPrompt(upstreamPrompt);
    }
  }, [upstreamPrompt]);

  const videoModels = useMemo(
    () => models.filter((item) => item.capability === "video"),
    [models],
  );
  const effectiveModel = useMemo(() => {
    if (model && videoModels.some((item) => item.id === model)) {
      return model;
    }
    return videoModels[0]?.id ?? "";
  }, [model, videoModels]);
  const selectedModel = videoModels.find((item) => item.id === effectiveModel);
  const modelIdentity = useMemo(
    () => toModelIdentity(selectedModel),
    [selectedModel],
  );

  const profile = useMemo(
    () => getVideoCapabilityProfile(modelIdentity),
    [modelIdentity],
  );
  const hasReferenceMedia = references.length > 0;
  const safeParams = useMemo(
    () =>
      sanitizeVideoParams(
        modelIdentity,
        params,
        resolveVideoSanitizeMediaFlags(
          modelIdentity,
          params,
          hasReferenceMedia,
        ),
      ),
    [hasReferenceMedia, modelIdentity, params],
  );
  const paramSegments = useMemo(
    () => buildVideoParamSummary(modelIdentity, safeParams, hasReferenceMedia),
    [hasReferenceMedia, modelIdentity, safeParams],
  );

  const syncNodeSize = (
    nextParams: PlaygroundVideoParams,
    nextModel: ModelIdentity,
    hasReference = references.length > 0,
  ) => {
    if (data?.url) {
      return;
    }
    const safe = sanitizeVideoParams(
      nextModel,
      nextParams,
      resolveVideoSanitizeMediaFlags(nextModel, nextParams, hasReference),
    );
    const size = canvasMediaNodeSize("video", videoAspectRatio(safe));
    setNodeSize(nodeId, size.width, size.height);
  };

  const persistParams = (next: PlaygroundVideoParams) => {
    const safe = sanitizeVideoParams(
      modelIdentity,
      next,
      resolveVideoSanitizeMediaFlags(
        modelIdentity,
        next,
        references.length > 0,
      ),
    );
    setParams(safe);
    updateNodeData(nodeId, { params: safe });
    syncNodeSize(safe, modelIdentity);
  };

  const commitModel = (
    nextModelId: string,
    nextParamsSource: PlaygroundVideoParams = params,
  ) => {
    const nextRecord = videoModels.find((item) => item.id === nextModelId);
    const nextModel = toModelIdentity(nextRecord);
    const nextParams = sanitizeVideoParams(
      nextModel,
      {
        ...DEFAULT_VIDEO_PARAMS,
        ...nextParamsSource,
      },
      resolveVideoSanitizeMediaFlags(
        nextModel,
        nextParamsSource,
        references.length > 0,
      ),
    );
    setModel(nextModelId);
    setParams(nextParams);
    updateNodeData(nodeId, {
      model: nextModelId,
      vendor: nextRecord?.vendor,
      params: nextParams,
    });
    syncNodeSize(nextParams, nextModel);
  };

  useEffect(() => {
    if (!effectiveModel) {
      return;
    }
    if (data?.model !== effectiveModel) {
      commitModel(effectiveModel);
      return;
    }
    const catalogVendor = selectedModel?.vendor?.trim() || undefined;
    if (catalogVendor && catalogVendor !== data?.vendor) {
      updateNodeData(nodeId, { vendor: catalogVendor });
    }
  }, [data?.model, data?.vendor, effectiveModel, selectedModel?.vendor, nodeId]);

  const modelControl = (
    <div className="min-w-0 max-w-[10rem]">
      {videoModels.length > 0 ? (
        <PlaygroundModelSelect
          id={`${nodeId}-model`}
          models={videoModels}
          value={effectiveModel}
          menuZIndex={70}
          className="w-full"
          onChange={(next) => commitModel(next)}
        />
      ) : (
        <span className="text-xs text-zinc-400">{messages.canvas.noModel}</span>
      )}
    </div>
  );

  const toolbarLeading = (
    <div className={PLAYGROUND_COMPOSER_TOOLBAR_LEADING_CLASS}>
      {modelControl}
      <PlaygroundMediaParamPill
        segments={paramSegments}
        disabled={!effectiveModel}
      >
        <PlaygroundVideoSettings
          formId={`${nodeId}-settings`}
          model={modelIdentity}
          params={safeParams}
          hasReferenceImage={hasReferenceMedia}
          embedded
          onChange={persistParams}
        />
      </PlaygroundMediaParamPill>
    </div>
  );

  const handleReferenceModeChange = (mode: VideoReferenceMode) => {
    persistParams({ ...params, referenceMode: mode });
  };

  const composer = (
    <PlaygroundVideoComposer
      prompt={prompt}
      references={references}
      referenceMode={safeParams.referenceMode}
      profile={profile}
      disabled={!effectiveModel}
      toolbarLeading={toolbarLeading}
      footerTrailing={
        <CanvasGenerationCost
          pricing={selectedModel?.pricing}
          kind="video"
          params={safeParams}
        />
      }
      surface="plain"
      onPromptChange={(next) => {
        promptEditedRef.current = true;
        setPrompt(next);
        updateNodeData(nodeId, { prompt: next });
      }}
      onReferencesChange={(next) => {
        const connectedUrls = new Set(
          upstreamReferences.map((item) => item.url),
        );
        const manual = next.filter(
          (item) => !item.url || !connectedUrls.has(item.url),
        );
        setManualReferences(manual);
        const stored: CanvasMediaReference[] = [];
        for (const item of manual) {
          if (item.url) {
            stored.push({
              mediaType: item.mediaType,
              url: item.url,
              name: item.name,
              ...(item.assetId ? { assetId: item.assetId } : {}),
            });
          }
        }
        updateNodeData(nodeId, { references: stored });
        syncNodeSize(params, modelIdentity, next.length > 0);
      }}
      onReferenceModeChange={handleReferenceModeChange}
      onGenerate={() => runNode(nodeId)}
    />
  );

  if (embedded) {
    return composer;
  }

  return (
    <div className="canvas-bottom-dock relative z-10 shrink-0 px-4 pb-2 pt-1">
      <div
        className={`mx-auto max-h-[46vh] w-full max-w-4xl overflow-y-auto px-3 pb-1 pt-2 ${CANVAS_GENERATION_BOTTOM_SURFACE_CLASS}`}
      >
        {composer}
      </div>
    </div>
  );
}
