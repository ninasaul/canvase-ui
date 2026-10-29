"use client";

import { ArrowUp, Gear } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { PlaygroundModelSelect } from "@/components/playground/playground-model-select";
import {
  CANVAS_GENERATION_FLOAT_SURFACE_CLASS,
  PLAYGROUND_CIRCLE_ACTION_CLASS,
  PLAYGROUND_CIRCLE_ACTION_SIZE,
  PLAYGROUND_COMPOSER_SHELL_PLAIN_CLASS,
  PLAYGROUND_COMPOSER_TEXTAREA_PAD_CLASS,
  PLAYGROUND_COMPOSER_TOOLBAR_CLASS,
  PLAYGROUND_COMPOSER_TOOLBAR_ICON_CLASS,
  PLAYGROUND_COMPOSER_TOOLBAR_ICON_SIZE,
  PLAYGROUND_COMPOSER_TOOLBAR_LEADING_CLASS,
} from "@/components/playground/playground-styles";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Textarea } from "@/components/ui/textarea";
import { useCanvasStore } from "@/lib/canvas/canvas-store";
import { useCanvasRunStatus } from "@/lib/canvas/canvas-run-status-store";
import { messages } from "@/messages";
import { useCanvasActions } from "./canvas-actions";
import { CanvasGenerationCost } from "./canvas-generation-cost";

export function CanvasTextGenerationDock({
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
  const data = node?.data;
  const [model, setModel] = useState(data?.model ?? "");
  const [systemOpen, setSystemOpen] = useState(
    Boolean(data?.systemPrompt?.trim()),
  );

  const chatModels = useMemo(
    () => models.filter((item) => item.capability === "chat"),
    [models],
  );
  const effectiveModel = useMemo(() => {
    if (model && chatModels.some((item) => item.id === model)) {
      return model;
    }
    return chatModels[0]?.id ?? "";
  }, [chatModels, model]);

  useEffect(() => {
    if (!effectiveModel) {
      return;
    }
    const catalogVendor = chatModels.find(
      (item) => item.id === effectiveModel,
    )?.vendor;
    if (data?.model !== effectiveModel) {
      updateNodeData(nodeId, {
        model: effectiveModel,
        vendor: catalogVendor,
      });
      return;
    }
    if (catalogVendor && catalogVendor !== data?.vendor) {
      updateNodeData(nodeId, { vendor: catalogVendor });
    }
  }, [
    data?.model,
    data?.vendor,
    effectiveModel,
    chatModels,
    nodeId,
    updateNodeData,
  ]);

  const textValue = data?.text ?? "";
  const systemPrompt = data?.systemPrompt ?? "";
  const runStatus = useCanvasRunStatus(nodeId);
  const effectiveStatus = runStatus?.status ?? data?.status;
  const running =
    effectiveStatus === "running" || effectiveStatus === "queued";
  const canSend =
    !running && Boolean(effectiveModel) && Boolean(textValue.trim());

  function submit() {
    if (!canSend) {
      return;
    }
    // The visible text is the prompt; generation replaces it with the result.
    updateNodeData(nodeId, { prompt: textValue });
    runNode(nodeId);
  }

  const body = (
    <div className={PLAYGROUND_COMPOSER_SHELL_PLAIN_CLASS}>
      <Textarea
        rows={2}
        variant="plain"
        value={textValue}
        placeholder={messages.canvas.textPlaceholder}
        className={`min-h-16 w-full resize-none ${PLAYGROUND_COMPOSER_TEXTAREA_PAD_CLASS}`}
        onChange={(event) =>
          updateNodeData(nodeId, { text: event.target.value })
        }
      />

      {systemOpen ? (
        <div className="border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
          <Textarea
            rows={2}
            variant="plain"
            value={systemPrompt}
            placeholder={messages.canvas.textSystemPromptPlaceholder}
            className="w-full resize-none text-xs"
            onChange={(event) =>
              updateNodeData(nodeId, {
                systemPrompt: event.target.value,
              })
            }
          />
        </div>
      ) : null}

      <div className={PLAYGROUND_COMPOSER_TOOLBAR_CLASS}>
        <div className={PLAYGROUND_COMPOSER_TOOLBAR_LEADING_CLASS}>
          <div className="w-32 shrink-0">
            {chatModels.length > 0 ? (
              <PlaygroundModelSelect
                id={`${nodeId}-text-model`}
                models={chatModels}
                value={effectiveModel}
                menuZIndex={70}
                className="w-full"
                onChange={(next) => {
                  setModel(next);
                  updateNodeData(nodeId, {
                    model: next,
                    vendor: chatModels.find((item) => item.id === next)
                      ?.vendor,
                  });
                }}
              />
            ) : (
              <span className="text-xs text-zinc-400">
                {messages.canvas.noModel}
              </span>
            )}
          </div>
          <CanvasGenerationCost
            pricing={
              chatModels.find((item) => item.id === effectiveModel)?.pricing
            }
            kind="text"
          />
        </div>

        <div className="flex min-w-0 items-center gap-1.5 sm:flex-1">
          <Button
            variant="ghost"
            size={PLAYGROUND_COMPOSER_TOOLBAR_ICON_SIZE}
            className={`${PLAYGROUND_COMPOSER_TOOLBAR_ICON_CLASS} relative`}
            aria-label={messages.canvas.textSystemPrompt}
            title={messages.canvas.textSystemPrompt}
            onClick={() => setSystemOpen((open) => !open)}
          >
            <Icon icon={Gear} size={15} />
            {systemPrompt.trim() ? (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-sky-500" />
            ) : null}
          </Button>
          <p className="min-w-0 flex-1 truncate pl-0.5 text-[11px] text-zinc-400 max-sm:hidden">
            {messages.canvas.textUnifiedHint}
          </p>
          <span className="shrink-0 tabular-nums text-[11px] text-zinc-400">
            {messages.playground.promptCharCount.replace(
              "{count}",
              String(textValue.length),
            )}
          </span>
          <Button
            variant="primary"
            size={PLAYGROUND_CIRCLE_ACTION_SIZE}
            className={PLAYGROUND_CIRCLE_ACTION_CLASS}
            disabled={!canSend}
            aria-label={messages.canvas.generateText}
            onClick={submit}
          >
            <Icon icon={ArrowUp} size={15} />
          </Button>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return body;
  }

  return (
    <div className="canvas-bottom-dock relative z-10 shrink-0 px-4 pb-4 pt-2">
      <div
        className={`mx-auto w-full max-w-4xl p-3 ${CANVAS_GENERATION_FLOAT_SURFACE_CLASS}`}
      >
        {body}
      </div>
    </div>
  );
}
