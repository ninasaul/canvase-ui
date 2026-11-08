"use client";

import { CaretDown, X } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PLAYGROUND_COMPOSER_PILL_CLASS } from "@/components/playground/playground-styles";
import { Icon } from "@/components/ui/icon";
import { Popover } from "@/components/ui/popover";
import { useMatchMedia } from "@/hooks/use-match-media";
import type { MediaParamSummarySegment } from "@/lib/playground/media-param-summary";
import { messages } from "@/messages";

type PlaygroundMediaParamPillProps = {
  segments: MediaParamSummarySegment[];
  disabled?: boolean;
  children: ReactNode;
};

/** Room for OptionRadioGroup grids + sliders without feeling like a full modal. */
const PARAM_POPOVER_MIN_WIDTH = 340;
const PARAM_POPOVER_MAX_WIDTH = 420;
const PARAM_POPOVER_MAX_HEIGHT = 480;

export function PlaygroundMediaParamPill({
  segments,
  disabled,
  children,
}: PlaygroundMediaParamPillProps) {
  const panelId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isNarrow = useMatchMedia("(max-width: 639px)");
  const labels =
    segments.length > 0
      ? segments.map((item) => item.label)
      : [messages.playground.paramSummaryFallback];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !isNarrow) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isNarrow, open]);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        id={`${panelId}-trigger`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        aria-label={messages.playground.paramSummaryAria}
        title={messages.playground.paramSummaryAria}
        className={PLAYGROUND_COMPOSER_PILL_CLASS}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex min-w-0 items-center overflow-hidden">
          {labels.map((label, index) => (
            <span key={`${label}-${index}`} className="flex items-center">
              {index > 0 ? (
                <span
                  className="mx-1 h-3 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700"
                  aria-hidden
                />
              ) : null}
              <span className="truncate tabular-nums">{label}</span>
            </span>
          ))}
        </span>
        <Icon
          icon={CaretDown}
          size={12}
          className="shrink-0 text-current opacity-60"
        />
      </button>
      {isNarrow ? (
        mounted && open
          ? createPortal(
              <div className="fixed inset-0 z-80 flex flex-col justify-end">
                <button
                  type="button"
                  className="absolute inset-0 bg-black/40"
                  aria-label={messages.close}
                  onClick={() => setOpen(false)}
                />
                <div
                  id={panelId}
                  role="dialog"
                  aria-label={messages.playground.paramsTitle}
                  className="relative z-10 flex max-h-[min(85dvh,36rem)] flex-col overflow-hidden rounded-t-2xl border border-zinc-300 bg-white shadow-xl dark:border-zinc-600 dark:bg-zinc-950"
                >
                  <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                        {messages.playground.paramsTitle}
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-400">
                        {messages.playground.paramsHint}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-[color,background-color] hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                      aria-label={messages.close}
                      onClick={() => setOpen(false)}
                    >
                      <Icon icon={X} size={16} />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    {children}
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null
      ) : (
        <Popover
          open={open}
          onOpenChange={setOpen}
          anchorRef={anchorRef}
          placement="top"
          id={panelId}
          role="dialog"
          ariaLabel={messages.playground.paramsTitle}
          flush
          className="border-zinc-300 dark:border-zinc-600"
          minWidth={PARAM_POPOVER_MIN_WIDTH}
          maxWidth={PARAM_POPOVER_MAX_WIDTH}
          maxHeight={PARAM_POPOVER_MAX_HEIGHT}
          zIndex={70}
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                {messages.playground.paramsTitle}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-400">
                {messages.playground.paramsHint}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="px-3 py-3">{children}</div>
            </div>
          </div>
        </Popover>
      )}
    </>
  );
}
