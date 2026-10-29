"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CheckCircle,
  Info,
  Warning,
  WarningCircle,
  X,
} from "@phosphor-icons/react";

import { Icon, type AppIconData } from "@/components/ui/icon";
import { messages } from "@/messages";

export type ToastType = "success" | "error" | "info" | "warning" | "message";

export type ToastOptions = {
  duration?: number;
  id?: string;
};

type ToastRecord = {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
};

const MAX_TOASTS = 5;
const DEFAULT_DURATION_MS = 3000;
const EMPTY_TOASTS: ToastRecord[] = [];

let toastRecords: ToastRecord[] = [];
let toastIdSequence = 0;
const listeners = new Set<() => void>();

function emitToastChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribeToasts(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getToastSnapshot() {
  return toastRecords;
}

function getServerToastSnapshot(): ToastRecord[] {
  return EMPTY_TOASTS;
}

function pushToast(type: ToastType, message: string, options?: ToastOptions) {
  const trimmed = message.trim();
  if (!trimmed) {
    return "";
  }

  const id = options?.id ?? `toast-${++toastIdSequence}`;
  const duration =
    typeof options?.duration === "number" && options.duration >= 0
      ? options.duration
      : DEFAULT_DURATION_MS;

  const next: ToastRecord = {
    id,
    type,
    message: trimmed,
    duration,
  };

  toastRecords = [next, ...toastRecords.filter((item) => item.id !== id)].slice(
    0,
    MAX_TOASTS,
  );
  emitToastChange();
  return id;
}

function dismissToast(id?: string) {
  if (id === undefined) {
    if (toastRecords.length === 0) {
      return;
    }
    toastRecords = [];
    emitToastChange();
    return;
  }

  const next = toastRecords.filter((item) => item.id !== id);
  if (next.length === toastRecords.length) {
    return;
  }
  toastRecords = next;
  emitToastChange();
}

export const toast = {
  success(message: string, options?: ToastOptions) {
    return pushToast("success", message, options);
  },
  error(message: string, options?: ToastOptions) {
    return pushToast("error", message, options);
  },
  danger(message: string, options?: ToastOptions) {
    return pushToast("error", message, options);
  },
  info(message: string, options?: ToastOptions) {
    return pushToast("info", message, options);
  },
  warning(message: string, options?: ToastOptions) {
    return pushToast("warning", message, options);
  },
  message(message: string, options?: ToastOptions) {
    return pushToast("message", message, options);
  },
  dismiss(id?: string) {
    dismissToast(id);
  },
};

const TYPE_ICON: Record<ToastType, AppIconData | null> = {
  success: CheckCircle,
  error: WarningCircle,
  info: Info,
  warning: Warning,
  message: null,
};

const TYPE_ICON_CLASS: Record<ToastType, string> = {
  success: "text-emerald-500/90 dark:text-emerald-400/90",
  error: "text-red-500/90 dark:text-red-400/90",
  info: "text-zinc-500 dark:text-zinc-400",
  warning: "text-amber-500/90 dark:text-amber-400/90",
  message: "text-zinc-400 dark:text-zinc-500",
};

function useToasts() {
  return useSyncExternalStore(
    subscribeToasts,
    getToastSnapshot,
    getServerToastSnapshot,
  );
}

function useToastAutoDismiss(item: ToastRecord, paused: boolean) {
  const remainingReference = useRef(item.duration);
  const startedAtReference = useRef<number | null>(null);

  useEffect(() => {
    if (item.duration === 0) {
      return;
    }

    if (paused) {
      if (startedAtReference.current !== null) {
        remainingReference.current = Math.max(
          0,
          remainingReference.current - (Date.now() - startedAtReference.current),
        );
        startedAtReference.current = null;
      }
      return;
    }

    if (remainingReference.current <= 0) {
      dismissToast(item.id);
      return;
    }

    startedAtReference.current = Date.now();
    const timer = window.setTimeout(() => {
      dismissToast(item.id);
    }, remainingReference.current);

    return () => {
      window.clearTimeout(timer);
      if (startedAtReference.current !== null) {
        remainingReference.current = Math.max(
          0,
          remainingReference.current - (Date.now() - startedAtReference.current),
        );
        startedAtReference.current = null;
      }
    };
  }, [item.duration, item.id, paused]);
}

function ToastItemContent({ item }: { item: ToastRecord }) {
  const [paused, setPaused] = useState(false);
  useToastAutoDismiss(item, paused);
  const icon = TYPE_ICON[item.type];

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex w-max max-w-[min(22rem,calc(100vw-2rem))] items-center gap-2 rounded-xl border border-zinc-200/70 bg-white/85 px-3 py-2 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_rgb(0_0_0/0.06)] backdrop-blur-md dark:border-zinc-700/60 dark:bg-zinc-950/85 dark:shadow-[0_1px_2px_rgb(0_0_0/0.35),0_8px_24px_rgb(0_0_0/0.4)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {icon ? (
        <span className={`inline-flex shrink-0 ${TYPE_ICON_CLASS[item.type]}`}>
          <Icon icon={icon} size={15} strokeWidth={1.6} />
        </span>
      ) : null}
      <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug tracking-tight text-zinc-700 dark:text-zinc-200">
        {item.message}
      </p>
      <button
        type="button"
        aria-label={messages.dismiss}
        className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-400/80 opacity-70 transition-[color,background-color,opacity,transform] duration-150 ease-out hover:bg-zinc-100/80 hover:text-zinc-600 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 active:scale-[0.96] dark:text-zinc-500 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-300 dark:focus-visible:ring-zinc-500/50"
        onClick={() => dismissToast(item.id)}
      >
        <Icon icon={X} size={12} strokeWidth={1.6} />
      </button>
    </div>
  );
}

export function Toaster() {
  const items = useToasts();
  const reduceMotion = useReducedMotion() ?? false;
  const mounted = useSyncExternalStore(
    subscribeNoop,
    getClientMountedSnapshot,
    getServerMountedSnapshot,
  );

  if (!mounted) {
    return null;
  }

  const transition = reduceMotion
    ? { duration: 0.12 }
    : { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const };

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-60 flex flex-col items-center gap-1.5 px-4 pt-4 sm:pt-5"
      aria-live="polite"
      aria-relevant="additions"
    >
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout={!reduceMotion}
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion
                ? { opacity: 0, transition: { duration: 0.12 } }
                : { opacity: 0, y: -8, scale: 0.98 }
            }
            transition={transition}
          >
            <ToastItemContent item={item} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
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
