"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type AnimationEvent,
  type FormEventHandler,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";

import { Icon } from "@/components/ui/icon";

export type ModalSize = "md" | "lg" | "xl" | "2xl" | "3xl" | "5xl" | "6xl" | "7xl";
export type ModalMotion = "enter" | "exit";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  /** Fires after the close exit animation finishes (or immediately when reduced-motion). */
  onExitComplete?: () => void;
  title: ReactNode;
  /** Optional secondary line under the title. */
  description?: ReactNode;
  /** Optional region below the title row; stays fixed with the header. */
  headerExtra?: ReactNode;
  /** `below`: extra row under title (default). `inline`: title + extra + close on one row (sm+). */
  headerExtraLayout?: "below" | "inline";
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  /**
   * default: padded panel; header/footer stay fixed, body scrolls.
   * frame: bordered header + scrollable body (list / wide content).
   */
  variant?: "default" | "frame";
  /** Render the panel as a form (for create/edit flows). */
  as?: "div" | "form";
  onSubmit?: FormEventHandler<HTMLFormElement>;
  titleId?: string;
  closeLabel: string;
  /** Extra classes on the panel surface. */
  className?: string;
  /** Extra classes on the scrollable content region. */
  contentClassName?: string;
  /** When false, the content region does not scroll (child manages overflow). Default true. */
  contentScrollable?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  /**
   * When false, skips the title/description header row.
   * Title is still rendered as `sr-only` for accessibility.
   * The close button remains unless `showCloseButton` is false.
   */
  showHeader?: boolean;
  /** Applied to the fixed portal root (e.g. z-index above canvas). */
  stackClassName?: string;
};

const escapeClosers: Array<() => void> = [];

const SIZE_CLASS: Record<ModalSize, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

const PANEL_BASE_CLASS =
  "w-full rounded-2xl bg-white shadow-xl dark:bg-zinc-950";

const CLOSE_BUTTON_CLASS =
  "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-500 transition-[color,background-color] duration-200 ease-out hover:bg-zinc-100 hover:text-zinc-800 disabled:pointer-events-none disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-zinc-200";

/** Keep in sync with `--ui-duration-slow` (plus a small buffer). */
export const MODAL_EXIT_DURATION_MS = 280;

export function resolveModalMotionClass(motion: ModalMotion): string {
  return motion === "exit" ? "ui-modal-exit" : "ui-modal-enter";
}

export function resolveModalPanelClassName(params: {
  size: ModalSize;
  className?: string;
  motion?: ModalMotion;
}): string {
  return [
    PANEL_BASE_CLASS,
    resolveModalMotionClass(params.motion ?? "enter"),
    "relative z-10 flex max-h-[min(90dvh,90vh)] w-full flex-col overflow-hidden",
    SIZE_CLASS[params.size],
    params.className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

function subscribeNoop() {
  return () => undefined;
}

function getClientMountedSnapshot() {
  return true;
}

function getServerMountedSnapshot() {
  return false;
}

function ModalHeader(params: {
  title: ReactNode;
  titleId: string;
  description?: ReactNode;
  headerExtra?: ReactNode;
  headerExtraLayout: "below" | "inline";
  closeLabel: string;
  onClose: () => void;
  showCloseButton: boolean;
  framed: boolean;
  disabled?: boolean;
}) {
  const headerShellClassName = params.framed
    ? "shrink-0 border-b border-zinc-100 p-4 dark:border-zinc-900 sm:p-5"
    : "shrink-0 px-5 pt-5";

  const closeButton = params.showCloseButton ? (
    <button
      type="button"
      onClick={params.onClose}
      disabled={params.disabled}
      className={`${CLOSE_BUTTON_CLASS} sm:order-last`}
      aria-label={params.closeLabel}
    >
      <Icon icon={X} size={16} />
    </button>
  ) : null;

  if (params.headerExtra && params.headerExtraLayout === "inline") {
    return (
      <div className={headerShellClassName}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex min-w-0 items-center justify-between gap-3 sm:contents">
            <h2
              id={params.titleId}
              className="shrink-0 text-base font-medium text-zinc-900 dark:text-zinc-50"
            >
              {params.title}
            </h2>
            {closeButton}
          </div>
          <div className="min-w-0 flex-1">{params.headerExtra}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={headerShellClassName}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id={params.titleId}
            className="text-base font-medium text-zinc-900 dark:text-zinc-50"
          >
            {params.title}
          </h2>
          {params.description ? (
            <div className="mt-1 text-xs text-zinc-400">{params.description}</div>
          ) : null}
        </div>
        {closeButton}
      </div>
      {params.headerExtra ? (
        <div className="mt-4 min-w-0">{params.headerExtra}</div>
      ) : null}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  onExitComplete,
  title,
  description,
  headerExtra,
  headerExtraLayout = "below",
  children,
  footer,
  size = "lg",
  variant = "default",
  as = "div",
  onSubmit,
  titleId: titleIdProp,
  closeLabel,
  className = "",
  contentClassName = "",
  contentScrollable = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  showHeader = true,
  stackClassName = "z-50",
}: ModalProps) {
  const generatedTitleId = useId();
  const titleId = titleIdProp ?? generatedTitleId;
  const mounted = useSyncExternalStore(
    subscribeNoop,
    getClientMountedSnapshot,
    getServerMountedSnapshot,
  );
  const framed = variant === "frame";
  const [rendered, setRendered] = useState(open);
  const [motion, setMotion] = useState<ModalMotion>(open ? "enter" : "exit");
  const [prevOpen, setPrevOpen] = useState(open);
  const exitCompletedRef = useRef(false);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setRendered(true);
      setMotion("enter");
    } else if (rendered) {
      setMotion("exit");
    }
  }

  useEffect(() => {
    if (motion === "enter") {
      exitCompletedRef.current = false;
    }
  }, [motion]);

  useEffect(() => {
    if (!rendered || motion !== "exit") {
      return;
    }

    const finishExit = () => {
      if (exitCompletedRef.current) {
        return;
      }
      exitCompletedRef.current = true;
      setRendered(false);
      onExitComplete?.();
    };

    const timeoutId = window.setTimeout(finishExit, MODAL_EXIT_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [motion, onExitComplete, rendered]);

  useEffect(() => {
    if (!rendered || motion === "exit" || !closeOnEscape) {
      return;
    }
    const close = () => onClose();
    escapeClosers.push(close);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || escapeClosers.at(-1) !== close) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      const index = escapeClosers.lastIndexOf(close);
      if (index >= 0) {
        escapeClosers.splice(index, 1);
      }
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [closeOnEscape, motion, onClose, rendered]);

  useEffect(() => {
    if (!rendered) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [rendered]);

  const handlePanelAnimationEnd = (event: AnimationEvent<HTMLElement>) => {
    if (motion !== "exit" || event.target !== event.currentTarget) {
      return;
    }
    if (exitCompletedRef.current) {
      return;
    }
    exitCompletedRef.current = true;
    setRendered(false);
    onExitComplete?.();
  };

  if (!rendered || !mounted) {
    return null;
  }

  const exiting = motion === "exit";
  const panelClassName = resolveModalPanelClassName({
    size,
    className,
    motion,
  });

  const body = (
    <>
      {showHeader ? (
        <ModalHeader
          title={title}
          titleId={titleId}
          description={description}
          headerExtra={headerExtra}
          headerExtraLayout={headerExtraLayout}
          closeLabel={closeLabel}
          onClose={onClose}
          showCloseButton={showCloseButton}
          framed={framed}
          disabled={exiting}
        />
      ) : (
        <>
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
          {showCloseButton ? (
            <div className="flex shrink-0 justify-end px-3 pt-3 sm:px-4 sm:pt-3">
              <button
                type="button"
                onClick={onClose}
                disabled={exiting}
                className={CLOSE_BUTTON_CLASS}
                aria-label={closeLabel}
              >
                <Icon icon={X} size={16} />
              </button>
            </div>
          ) : null}
        </>
      )}
      <div
        className={
          framed
            ? `min-h-0 flex-1 ${
                contentScrollable
                  ? "overflow-auto p-5"
                  : "flex flex-col overflow-hidden p-0"
              } ${contentClassName}`.trim()
            : `min-h-0 flex-1 ${
                contentScrollable
                  ? "overflow-auto px-5 py-4"
                  : "flex flex-col overflow-hidden p-0"
              } ${contentClassName}`.trim()
        }
      >
        {children}
      </div>
      {footer ? (
        <div
          className={
            framed
              ? "shrink-0 border-t border-zinc-100 p-4 dark:border-zinc-900 sm:p-5"
              : "shrink-0 border-t border-zinc-100 px-5 py-4 dark:border-zinc-900"
          }
        >
          {footer}
        </div>
      ) : null}
    </>
  );

  const panel =
    as === "form" ? (
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={panelClassName}
        onClick={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
        onAnimationEnd={handlePanelAnimationEnd}
      >
        {body}
      </form>
    ) : (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={panelClassName}
        onClick={(event) => event.stopPropagation()}
        onAnimationEnd={handlePanelAnimationEnd}
      >
        {body}
      </div>
    );

  return createPortal(
    <div
      className={`fixed inset-0 flex items-end justify-center p-4 sm:items-center ${stackClassName}`.trim()}
      role="presentation"
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-zinc-950/45 backdrop-blur-sm dark:bg-white/20 ${
          exiting ? "ui-overlay-exit pointer-events-none" : "ui-overlay-enter"
        }`}
        onClick={!exiting && closeOnOverlayClick ? onClose : undefined}
      />
      {panel}
    </div>,
    document.body,
  );
}
