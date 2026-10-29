import type { HTMLAttributes, ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "capability_chat"
  | "capability_image"
  | "capability_video"
  | "capability_speech"
  | "capability_rerank"
  | "capability_moderation";

export type AdminStatusKind = "user" | "license" | "redeem_code" | "generation" | "device";

const BASE_CLASS =
  "inline-flex shrink-0 items-center font-medium";

const SIZE_CLASS = {
  mini: "rounded px-1.5 py-px text-[10px]",
  sm: "rounded-md px-2 py-0.5 text-[10px]",
  md: "rounded-md px-2.5 py-1 text-xs",
} as const;

export type BadgeSize = keyof typeof SIZE_CLASS;

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  capability_chat: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  capability_image:
    "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300",
  capability_video:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  capability_speech:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  capability_rerank:
    "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  capability_moderation:
    "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
};

export type BadgeClassNameOptions = {
  tone?: BadgeTone;
  size?: BadgeSize;
  className?: string;
};

export function badgeClassName({
  tone = "neutral",
  size = "sm",
  className = "",
}: BadgeClassNameOptions = {}): string {
  return `${BASE_CLASS} ${SIZE_CLASS[size]} ${TONE_CLASS[tone]} ${className}`.trim();
}

/** 生成任务状态 -> Badge tone */
export function statusBadgeTone(
  status: "pending" | "processing" | "success" | "failed" | string,
): BadgeTone {
  switch (status) {
    case "success":
      return "success";
    case "failed":
      return "danger";
    case "processing":
    case "running":
      return "warning";
    case "pending":
      return "info";
    default:
      return "neutral";
  }
}

/** 后台管理各域状态 -> Badge tone */
export function adminStatusBadgeTone(kind: AdminStatusKind, status: string): BadgeTone {
  const normalized = status.trim().toLowerCase();

  switch (kind) {
    case "user":
      if (normalized === "disabled" || normalized === "true") {
        return "danger";
      }
      if (normalized === "active" || normalized === "false" || normalized === "enabled") {
        return "success";
      }
      return "neutral";
    case "license":
      if (normalized === "active") {
        return "success";
      }
      if (normalized === "revoked") {
        return "danger";
      }
      if (normalized === "expired") {
        return "warning";
      }
      if (normalized === "unused") {
        return "neutral";
      }
      return "neutral";
    case "redeem_code":
      if (normalized === "active") {
        return "success";
      }
      if (normalized === "disabled") {
        return "danger";
      }
      if (normalized === "expired" || normalized === "exhausted") {
        return "warning";
      }
      return "neutral";
    case "generation":
      return statusBadgeTone(normalized);
    case "device":
      if (normalized === "revoked" || normalized === "inactive") {
        return "danger";
      }
      if (normalized === "active") {
        return "success";
      }
      return "neutral";
    default:
      return "neutral";
  }
}

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  size?: BadgeSize;
  children?: ReactNode;
};

export function Badge({
  tone = "neutral",
  size = "sm",
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={badgeClassName({ tone, size, className })} {...props}>
      {children}
    </span>
  );
}
