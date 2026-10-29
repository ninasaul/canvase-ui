"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PlaygroundImageComposer } from "@/components/playground/playground-image-composer";
import { PlaygroundImageSettings } from "@/components/playground/playground-image-settings";
import { PlaygroundMediaParamPill } from "@/components/playground/playground-media-param-pill";
import { PlaygroundModelSelect } from "@/components/playground/playground-model-select";
import { PLAYGROUND_COMPOSER_TOOLBAR_LEADING_CLASS } from "@/components/playground/playground-styles";
import { CanvasGenerationCost } from "./canvas-generation-cost";
import { useCanvasUpstreamPrompt } from "@/lib/canvas/use-canvas-upstream-prompt";
import { useCanvasUpstreamImages } from "@/lib/canvas/use-canvas-upstream-images";
import type { CanvasMediaReference } from "@/lib/tu-shared-browser";
import { useCanvasStore } from "@/lib/canvas/canvas-store";
import {
  canvasMediaNodeSize,
  imageAspectRatio,
} from "@/lib/canvas/canvas-node-size";
import {
  DEFAULT_IMAGE_PARAMS,
  sanitizeImageParams,
  toImagePlaygroundModel,
  type PlaygroundImageParams,
} from "@canvase/generation-params/image";
import {
  createUrlReference,
  type PlaygroundImageReference,
} from "@/lib/playground/image-references";
import { buildImageParamSummary } from "@/lib/playground/media-param-summary";
import { messages } from "@/messages";
import { CANVAS_GENERATION_FLOAT_SURFACE_CLASS } from "@/components/playground/playground-styles";
import { useCanvasActions } from "./canvas-actions";

/**
 * Bottom-docked generation composer for an image node.
 * Uses the same mode/model/param/composer components as the workbench.
 */
export function CanvasImageGenerationDock({
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
  const referenceUrls = (data?.referenceUrls as string[] | undefined) ?? [];
  const storedReferences =
    (data?.references as CanvasMediaReference[] | undefined) ?? [];
  const [model, setModel] = useState(data?.model ?? "");
  const upstreamPrompt = useCanvasUpstreamPrompt(nodeId);
  const [prompt, setPrompt] = useState(data?.prompt || upstreamPrompt);
  const promptEditedRef = useRef(Boolean(data?.prompt?.trim()));
  const [params, setParams] = useState<PlaygroundImageParams>(() => ({
    ...DEFAULT_IMAGE_PARAMS,
    ...((data?.params as Partial<PlaygroundImageParams> | undefined) ?? {}),
  }));
  const upstreamImages = useCanvasUpstreamImages(nodeId);
  const upstreamReferences = useMemo(
    () =>
      upstreamImages.map((item, index) =>
        createUrlReference(item.url, index, item.assetId),
      ),
    [upstreamImages],
  );
  const [manualReferences, setManualReferences] = useState<
    PlaygroundImageReference[]
  >(() => {
    const connectedUrls = new Set(upstreamReferences.map((item) => item.url));
    const stored =
      storedReferences.length > 0
        ? storedReferences
            .filter((item) => item.mediaType === "image")
            .map((item, index) =>
              createUrlReference(item.url, index, item.assetId),
            )
        : referenceUrls.map((url, index) => createUrlReference(url, index));
    return stored.filter(
      (item) => !item.url || !connectedUrls.has(item.url),
    );
  });
  const references = useMemo(() => {
    const seen = new Set<string>();
    return [...upstreamReferences, ...manualReferences].filter((item) => {
      if (!item.url || seen.has(item.url)) {
        return false;
      }
      seen.add(item.url);
      return true;
    });
  }, [manualReferences, upstreamReferences]);

  useEffect(() => {
    if (!promptEditedRef.current) {
      setPrompt(upstreamPrompt);
    }
  }, [upstreamPrompt]);

  const imageModels = useMemo(
    () => models.filter((item) => item.capability === "image"),
    [models],
  );
  const effectiveModel = useMemo(() => {
    if (model && imageModels.some((item) => item.id === model)) {
      return model;
    }
    return imageModels[0]?.id ?? "";
  }, [imageModels, model]);
  const selectedModel = imageModels.find((item) => item.id === effectiveModel);
  const imageModel = useMemo(
    () => toImagePlaygroundModel(selectedModel),
    [selectedModel],
  );
  const safeParams = useMemo(
    () => sanitizeImageParams(imageModel, params),
    [imageModel, params],
  );
  const paramSegments = useMemo(
    () => buildImageParamSummary(imageModel, safeParams),
    [imageModel, safeParams],
  );

  const syncNodeSize = (
    nextParams: PlaygroundImageParams,
    nextImageModel: ReturnType<typeof toImagePlaygroundModel>,
  ) => {
    if (data?.url) {
      return;
    }
    const safe = sanitizeImageParams(nextImageModel, nextParams);
    const size = canvasMediaNodeSize("image", imageAspectRatio(safe));
    setNodeSize(nodeId, size.width, size.height);
  };

  const commitModel = (
    nextModelId: string,
    nextParamsSource: PlaygroundImageParams = params,
  ) => {
    const nextRecord = imageModels.find((item) => item.id === nextModelId);
    const nextImageModel = toImagePlaygroundModel(nextRecord);
    const nextParams = sanitizeImageParams(nextImageModel, {
      ...DEFAULT_IMAGE_PARAMS,
      ...nextParamsSource,
    });
    setModel(nextModelId);
    setParams(nextParams);
    updateNodeData(nodeId, {
      model: nextModelId,
      vendor: nextRecord?.vendor,
      params: nextParams,
    });
    syncNodeSize(nextParams, nextImageModel);
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
      {imageModels.length > 0 ? (
        <PlaygroundModelSelect
          id={`${nodeId}-model`}
          models={imageModels}
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
        <PlaygroundImageSettings
          formId={`${nodeId}-settings`}
          model={imageModel}
          params={safeParams}
          embedded
          onChange={(next) => {
            const safe = sanitizeImageParams(imageModel, next);
            setParams(safe);
            updateNodeData(nodeId, { params: safe });
            syncNodeSize(safe, imageModel);
          }}
        />
      </PlaygroundMediaParamPill>
      <CanvasGenerationCost
        pricing={selectedModel?.pricing}
        kind="image"
        params={safeParams}
      />
    </div>
  );

  const composer = (
    <PlaygroundImageComposer
      model={imageModel}
      prompt={prompt}
      references={references}
      disabled={!effectiveModel}
      toolbarLeading={toolbarLeading}
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
        const urls = manual
          .map((item) => item.url?.trim() ?? "")
          .filter((url): url is string => Boolean(url));
        updateNodeData(nodeId, {
          referenceUrls: urls,
          references: manual
            .filter((item) => Boolean(item.url?.trim()))
            .map((item) => ({
              mediaType: "image" as const,
              url: item.url!.trim(),
              name: item.name,
              ...(item.assetId ? { assetId: item.assetId } : {}),
            })),
        });
      }}
      onGenerate={() => runNode(nodeId)}
    />
  );

  if (embedded) {
    return composer;
  }

  return (
    <div className="canvas-bottom-dock relative z-10 shrink-0 px-4 pb-4 pt-2">
      <div
        className={`mx-auto max-h-[46vh] w-full max-w-4xl overflow-y-auto p-3 ${CANVAS_GENERATION_FLOAT_SURFACE_CLASS}`}
      >
        {composer}
      </div>
    </div>
  );
}
