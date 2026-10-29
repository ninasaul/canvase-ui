"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type TooltipPlacement = "top" | "bottom";
type TooltipVariant = "compact" | "panel";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  /** Accessible name when content is not plain text. */
  label?: string;
  placement?: TooltipPlacement;
  variant?: TooltipVariant;
  /** Skip opening (e.g. text is not truncated). */
  disabled?: boolean;
  /**
   * Allow pointer over the tooltip surface (copy / read long text).
   * Keeps the tip open while the cursor moves from trigger → tip.
   * Default: true for panel, false for compact.
   */
  interactive?: boolean;
  /** Open delay in ms. */
  delayMs?: number;
  /** Close delay in ms when interactive (bridge trigger → tip). */
  closeDelayMs?: number;
  className?: string;
  contentClassName?: string;
  zIndex?: number;
};

type TooltipCoords = {
  top: number;
  left: number;
  opensUpward: boolean;
};

const TOOLTIP_GAP_PX = 8;
const VIEWPORT_PADDING_PX = 8;
const DEFAULT_CLOSE_DELAY_MS = 120;
const EXIT_DURATION_MS = 120;

function resolveVariantClassName(variant: TooltipVariant): string {
  if (variant === "panel") {
    return "w-72 max-w-[min(18rem,calc(100vw-1rem))] rounded-xl border border-zinc-200/90 bg-white p-3 text-xs leading-relaxed text-zinc-600 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:shadow-black/40";
  }
  return "max-w-[min(20rem,calc(100vw-1rem))] rounded-md bg-zinc-800 px-2 py-1 text-[11px] font-medium leading-relaxed whitespace-pre-wrap text-white shadow-sm dark:bg-zinc-200 dark:text-zinc-900";
}

function resolveMotionClassName(
  opensUpward: boolean,
  motion: "enter" | "exit",
): string {
  if (motion === "exit") {
    return opensUpward ? "ui-tooltip-exit-top" : "ui-tooltip-exit-bottom";
  }
  return opensUpward ? "ui-tooltip-enter-top" : "ui-tooltip-enter-bottom";
}

function clampTooltipLeft(
  preferredLeft: number,
  tooltipWidth: number,
): number {
  const maxLeft =
    window.innerWidth - VIEWPORT_PADDING_PX - Math.max(tooltipWidth, 1);
  return Math.min(
    Math.max(preferredLeft, VIEWPORT_PADDING_PX),
    Math.max(VIEWPORT_PADDING_PX, maxLeft),
  );
}

function getTooltipCoords(
  trigger: DOMRect,
  tooltip: DOMRect,
  placement: TooltipPlacement,
): TooltipCoords {
  const preferredLeft =
    trigger.left + trigger.width / 2 - tooltip.width / 2;
  const left = clampTooltipLeft(preferredLeft, tooltip.width);

  if (placement === "top") {
    const top = trigger.top - TOOLTIP_GAP_PX - tooltip.height;
    if (top >= VIEWPORT_PADDING_PX) {
      return { top, left, opensUpward: true };
    }
    return {
      top: trigger.bottom + TOOLTIP_GAP_PX,
      left,
      opensUpward: false,
    };
  }

  const top = trigger.bottom + TOOLTIP_GAP_PX;
  const overflowsBottom =
    top + tooltip.height > window.innerHeight - VIEWPORT_PADDING_PX;
  if (
    overflowsBottom &&
    trigger.top - TOOLTIP_GAP_PX - tooltip.height >= VIEWPORT_PADDING_PX
  ) {
    return {
      top: trigger.top - TOOLTIP_GAP_PX - tooltip.height,
      left,
      opensUpward: true,
    };
  }
  return { top, left, opensUpward: false };
}

/** Hover tooltip rendered through a body portal (survives overflow clipping). */
export function Tooltip({
  content,
  children,
  label,
  placement = "top",
  variant = "compact",
  disabled = false,
  interactive,
  delayMs = 0,
  closeDelayMs = DEFAULT_CLOSE_DELAY_MS,
  className = "",
  contentClassName = "",
  zIndex = 80,
}: TooltipProps) {
  const allowInteractive = interactive ?? variant === "panel";
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const exitCompletedRef = useRef(false);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [motion, setMotion] = useState<"enter" | "exit">("enter");
  const [coords, setCoords] = useState<TooltipCoords | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current != null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const beginClose = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    setOpen(false);
  }, [clearCloseTimer, clearOpenTimer]);

  const scheduleClose = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    if (!allowInteractive || closeDelayMs <= 0) {
      setOpen(false);
      return;
    }
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
    }, closeDelayMs);
  }, [allowInteractive, clearCloseTimer, clearOpenTimer, closeDelayMs]);

  const scheduleOpen = useCallback(() => {
    if (disabled) {
      return;
    }
    clearCloseTimer();
    clearOpenTimer();
    if (delayMs <= 0) {
      setOpen(true);
      return;
    }
    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null;
      setOpen(true);
    }, delayMs);
  }, [clearCloseTimer, clearOpenTimer, delayMs, disabled]);

  useEffect(() => {
    if (disabled && open) {
      beginClose();
    }
  }, [beginClose, disabled, open]);

  useEffect(
    () => () => {
      clearOpenTimer();
      clearCloseTimer();
    },
    [clearCloseTimer, clearOpenTimer],
  );

  useEffect(() => {
    if (open) {
      exitCompletedRef.current = false;
      setRendered(true);
      setMotion("enter");
      return;
    }
    if (rendered) {
      setMotion("exit");
    }
  }, [open, rendered]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) {
      return;
    }
    setCoords(
      getTooltipCoords(
        trigger.getBoundingClientRect(),
        tooltip.getBoundingClientRect(),
        placement,
      ),
    );
  }, [placement]);

  useLayoutEffect(() => {
    if (!rendered || motion === "exit") {
      return;
    }
    updatePosition();
  }, [rendered, motion, content, updatePosition]);

  useEffect(() => {
    if (!rendered || motion === "exit") {
      return;
    }
    const onReposition = () => updatePosition();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [rendered, motion, updatePosition]);

  useEffect(() => {
    if (!rendered || motion !== "exit") {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      if (exitCompletedRef.current) {
        return;
      }
      exitCompletedRef.current = true;
      setRendered(false);
      setCoords(null);
    }, EXIT_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [motion, rendered]);

  const handleAnimationEnd = (event: AnimationEvent<HTMLSpanElement>) => {
    if (motion !== "exit" || event.target !== event.currentTarget) {
      return;
    }
    if (exitCompletedRef.current) {
      return;
    }
    exitCompletedRef.current = true;
    setRendered(false);
    setCoords(null);
  };

  const describedBy = open ? tooltipId : undefined;
  const accessibleLabel =
    label ?? (typeof content === "string" ? content : undefined);
  const opensUpward = coords?.opensUpward ?? placement === "top";

  const tooltipStyle: CSSProperties = {
    zIndex,
    top: coords?.top ?? 0,
    left: coords?.left ?? 0,
    // Hide until measured so the layer cannot cover the hover target.
    visibility: coords ? "visible" : "hidden",
  };

  return (
    <>
      <span
        ref={triggerRef}
        className={["min-w-0 cursor-pointer", className || "inline-flex"]
          .filter(Boolean)
          .join(" ")}
        aria-describedby={describedBy}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
      >
        {children}
      </span>
      {mounted && rendered
        ? createPortal(
            <span
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              aria-label={accessibleLabel}
              className={[
                allowInteractive && motion === "enter"
                  ? "pointer-events-auto"
                  : "pointer-events-none",
                "fixed",
                resolveVariantClassName(variant),
                coords ? resolveMotionClassName(opensUpward, motion) : "",
                contentClassName,
              ]
                .filter(Boolean)
                .join(" ")}
              style={tooltipStyle}
              onAnimationEnd={handleAnimationEnd}
              onMouseEnter={() => {
                if (!allowInteractive) {
                  return;
                }
                clearCloseTimer();
                scheduleOpen();
              }}
              onMouseLeave={() => {
                if (!allowInteractive) {
                  return;
                }
                scheduleClose();
              }}
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
