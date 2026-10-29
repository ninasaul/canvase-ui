"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

type PopoverPlacement = "top" | "bottom";

type PopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef?: RefObject<HTMLElement | null>;
  anchorRect?: DOMRect | null;
  placement?: PopoverPlacement;
  id?: string;
  role?: string;
  ariaLabel?: string;
  children: ReactNode;
  /** Sticky top slot (e.g. search). */
  header?: ReactNode;
  /** Sticky bottom slot. */
  footer?: ReactNode;
  className?: string;
  /**
   * No default padding / outer scroll. Use when the caller owns an internal
   * scroll region that must sit flush to the panel edges.
   */
  flush?: boolean;
  minWidth?: number;
  maxWidth?: number;
  maxHeight?: number;
  zIndex?: number;
};

type PopoverPosition = {
  top?: number;
  bottom?: number;
  left: number;
  minWidth: number;
  maxWidth: number;
  maxHeight: number;
  opensUpward: boolean;
};

function samePosition(
  left: PopoverPosition | null,
  right: PopoverPosition,
): boolean {
  return Boolean(
    left &&
      left.top === right.top &&
      left.bottom === right.bottom &&
      left.left === right.left &&
      left.minWidth === right.minWidth &&
      left.maxWidth === right.maxWidth &&
      left.maxHeight === right.maxHeight &&
      left.opensUpward === right.opensUpward,
  );
}

const POPOVER_GAP = 8;
const VIEWPORT_PADDING = 8;
const DEFAULT_MAX_HEIGHT = 280;
const DEFAULT_MAX_WIDTH = 320;
const DEFAULT_MIN_WIDTH = 220;
const EXIT_DURATION_MS = 180;

function resolveMotionClassName(opensUpward: boolean, motion: "enter" | "exit") {
  if (motion === "exit") {
    return opensUpward ? "ui-menu-exit-top" : "ui-menu-exit-bottom";
  }
  return opensUpward ? "ui-menu-enter-top" : "ui-menu-enter-bottom";
}

function getAnchorRect(
  anchorRef?: RefObject<HTMLElement | null>,
  anchorRect?: DOMRect | null,
): DOMRect | null {
  if (anchorRect) {
    return anchorRect;
  }
  if (anchorRef?.current) {
    return anchorRef.current.getBoundingClientRect();
  }
  return null;
}

function getPopoverPosition(
  anchor: DOMRect,
  preferredPlacement: PopoverPlacement,
  options: {
    minWidth: number;
    maxWidth: number;
    maxHeight: number;
    measuredHeight?: number;
  },
): PopoverPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const estimatedHeight = options.measuredHeight ?? options.maxHeight;
  const spaceBelow =
    viewportHeight - anchor.bottom - POPOVER_GAP - VIEWPORT_PADDING;
  const spaceAbove = anchor.top - POPOVER_GAP - VIEWPORT_PADDING;

  const opensUpward =
    preferredPlacement === "top"
      ? spaceAbove >= Math.min(estimatedHeight, spaceBelow) || spaceAbove > spaceBelow
      : spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

  const viewportCap = viewportWidth - VIEWPORT_PADDING * 2;
  const resolvedMinWidth = Math.min(viewportCap, options.minWidth);
  const resolvedMaxWidth = Math.min(viewportCap, options.maxWidth);
  const left = Math.min(
    Math.max(anchor.left, VIEWPORT_PADDING),
    viewportWidth - VIEWPORT_PADDING - resolvedMinWidth,
  );

  if (opensUpward) {
    return {
      left,
      minWidth: resolvedMinWidth,
      maxWidth: resolvedMaxWidth,
      maxHeight: Math.min(options.maxHeight, Math.max(0, spaceAbove)),
      bottom: viewportHeight - anchor.top + POPOVER_GAP,
      opensUpward,
    };
  }

  return {
    left,
    minWidth: resolvedMinWidth,
    maxWidth: resolvedMaxWidth,
    maxHeight: Math.min(options.maxHeight, Math.max(0, spaceBelow)),
    top: anchor.bottom + POPOVER_GAP,
    opensUpward,
  };
}

export function Popover({
  open,
  onOpenChange,
  anchorRef,
  anchorRect,
  placement = "bottom",
  id,
  role = "listbox",
  ariaLabel,
  children,
  header,
  footer,
  className = "",
  flush = false,
  minWidth = DEFAULT_MIN_WIDTH,
  maxWidth = DEFAULT_MAX_WIDTH,
  maxHeight = DEFAULT_MAX_HEIGHT,
  zIndex = 60,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const exitCompletedRef = useRef(false);
  const [rendered, setRendered] = useState(open);
  const [motion, setMotion] = useState<"enter" | "exit">("enter");
  const [prevOpen, setPrevOpen] = useState(open);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setRendered(true);
      setMotion("enter");
      exitCompletedRef.current = false;
    } else if (rendered) {
      setMotion("exit");
    }
  }

  const updatePosition = useCallback(
    (measuredHeight?: number) => {
      const anchor = getAnchorRect(anchorRef, anchorRect);
      if (!anchor) {
        return;
      }
      const next = getPopoverPosition(anchor, placement, {
        minWidth,
        maxWidth,
        maxHeight,
        measuredHeight,
      });
      setPosition((current) => (samePosition(current, next) ? current : next));
    },
    [anchorRect, anchorRef, maxHeight, maxWidth, minWidth, placement],
  );

  useLayoutEffect(() => {
    if (!open || !rendered || motion === "exit") {
      return;
    }
    updatePosition(panelRef.current?.scrollHeight);
  }, [motion, open, rendered, updatePosition]);

  useEffect(() => {
    if (!open || !rendered || motion === "exit" || !panelRef.current) {
      return;
    }
    const panel = panelRef.current;
    const observer = new ResizeObserver(() => {
      updatePosition(panel.scrollHeight);
    });
    observer.observe(panel);
    return () => observer.disconnect();
  }, [motion, open, rendered, updatePosition]);

  useEffect(() => {
    if (!open || !rendered || motion === "exit") {
      return;
    }

    updatePosition();

    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) {
        return;
      }
      if (anchorRef?.current?.contains(target)) {
        return;
      }
      onOpenChange(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    const handleLayoutChange = (event?: Event) => {
      const target = event?.target;
      if (target instanceof Node && panelRef.current?.contains(target)) {
        return;
      }
      updatePosition(panelRef.current?.scrollHeight);
    };

    window.addEventListener("pointerdown", handleOutsidePointer);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleLayoutChange);
    window.addEventListener("scroll", handleLayoutChange, true);
    return () => {
      window.removeEventListener("pointerdown", handleOutsidePointer);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleLayoutChange);
      window.removeEventListener("scroll", handleLayoutChange, true);
    };
  }, [anchorRef, motion, onOpenChange, open, rendered, updatePosition]);

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
      setPosition(null);
    }, EXIT_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [motion, rendered]);

  const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (motion !== "exit" || event.target !== event.currentTarget) {
      return;
    }
    if (exitCompletedRef.current) {
      return;
    }
    exitCompletedRef.current = true;
    setRendered(false);
    setPosition(null);
  };

  if (!rendered || !position) {
    return null;
  }

  const style: CSSProperties = {
    position: "fixed",
    left: position.left,
    top: position.top,
    bottom: position.bottom,
    minWidth: position.minWidth,
    maxWidth: position.maxWidth,
    maxHeight: position.maxHeight,
    zIndex,
  };

  const bodyPaddingClass = flush ? "p-0" : "p-1.5";
  const panel = (
    <div
      ref={panelRef}
      id={id}
      role={role}
      aria-label={ariaLabel}
      data-popover-portal=""
      style={style}
      className={`flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900 ${resolveMotionClassName(position.opensUpward, motion)} ${className}`.trim()}
      onAnimationEnd={handleAnimationEnd}
    >
      {header != null ? (
        <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-800">
          {header}
        </div>
      ) : null}
      <div className={`min-h-0 flex-1 overflow-y-auto ${bodyPaddingClass}`}>
        {children}
      </div>
      {footer != null ? (
        <div className="shrink-0 border-t border-zinc-100 dark:border-zinc-800">
          {footer}
        </div>
      ) : null}
    </div>
  );

  return typeof document !== "undefined" ? createPortal(panel, document.body) : null;
}
