"use client";

import { Stack } from "@phosphor-icons/react";
import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { useTheme } from "@/components/theme-provider";
import {
  modelLogoSrc,
  resolveModelLogoStem,
  type ModelLogoTheme,
} from "@/lib/model-logo";

export function ModelNameWithLogo({
  name,
  matchParts,
  mono = false,
  size = 18,
  className = "",
  logoTheme,
  nameClassName,
  logoShellClassName,
  wrap = false,
  nameMaxWidthClass = "max-w-xs",
  layout = "inline",
}: {
  /** Visible label (usually display name). Empty/whitespace → "—". */
  name: string | null | undefined;
  /** Extra strings used to resolve the logo (id, owned_by, …). */
  matchParts?: Array<string | null | undefined>;
  mono?: boolean;
  size?: number;
  className?: string;
  /** Force logo variant (e.g. dark surface while page theme is light). */
  logoTheme?: ModelLogoTheme;
  /** When `contents`, children participate in a parent grid (logo + name cells). */
  layout?: "inline" | "contents";
  nameClassName?: string;
  logoShellClassName?: string;
  /** Wrap long model titles within a max width instead of truncating. */
  wrap?: boolean;
  nameMaxWidthClass?: string;
}) {
  const label = name?.trim() || "";
  const { resolvedTheme } = useTheme();
  const theme: ModelLogoTheme =
    logoTheme ?? (resolvedTheme === "dark" ? "dark" : "light");
  const stem = label
    ? resolveModelLogoStem(label, ...(matchParts ?? []))
    : null;
  const src = stem ? modelLogoSrc(stem, theme) : null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = Boolean(src && failedSrc === src);

  if (!label) {
    return <span className="text-zinc-400">—</span>;
  }

  const defaultNameClass = mono
    ? "font-mono text-xs text-zinc-700 dark:text-zinc-300"
    : "text-sm text-zinc-900 dark:text-zinc-50";

  const nameLayoutClass = wrap
    ? `break-all whitespace-normal ${nameMaxWidthClass}`
    : "truncate";

  const shellSize = size + 6;
  const rootClass =
    layout === "contents"
      ? `contents ${className}`.trim()
      : `inline-flex min-w-0 max-w-full gap-2 ${wrap ? "items-start" : "items-center"} ${className}`.trim();

  return (
    <span className={rootClass}>
      <span
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900 ${logoShellClassName ?? ""}`.trim()}
        style={{ width: shellSize, height: shellSize }}
        aria-hidden
      >
        {src && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element -- theme SVG from /public
          <img
            src={src}
            alt=""
            width={size}
            height={size}
            className="object-contain"
            onError={() => setFailedSrc(src)}
          />
        ) : (
          <Icon
            icon={Stack}
            size={Math.max(12, size - 2)}
            className="text-zinc-400"
          />
        )}
      </span>
      <span
        className={`min-w-0 ${nameLayoutClass} ${nameClassName ?? defaultNameClass}`}
        title={wrap ? undefined : label}
      >
        {label}
      </span>
    </span>
  );
}
