import { FrameCorners } from "@phosphor-icons/react";
import { Icon } from "@/components/ui/icon";
import type { OptionRadioItem } from "@/components/ui/option-radio-group";
import { toRadioOptions } from "@/lib/playground/param-options";

export function parseColonRatio(value: string): { w: number; h: number } | null {
  if (value === "auto" || value === "adaptive") {
    return null;
  }
  const parts = value.split(":");
  if (parts.length !== 2) {
    return null;
  }
  const w = Number(parts[0]);
  const h = Number(parts[1]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return null;
  }
  return { w, h };
}

export function parsePixelSize(value: string): { w: number; h: number } | null {
  const match = /^(\d+)x(\d+)$/i.exec(value.trim());
  if (!match) {
    return null;
  }
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return null;
  }
  return { w, h };
}

export function AspectShapeIcon({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  const parsed = parseColonRatio(value) ?? parsePixelSize(value);
  if (!parsed) {
    return (
      <Icon icon={FrameCorners} size={14} className={className} />
    );
  }

  const max = 16;
  const { w, h } = parsed;
  const width =
    w >= h ? max : Math.max(5, Math.round((max * w) / h));
  const height =
    h >= w ? max : Math.max(5, Math.round((max * h) / w));

  return (
    <span
      className={`inline-flex h-4 w-4 items-center justify-center ${className}`.trim()}
      aria-hidden
    >
      <span
        className="rounded-xs border border-current bg-current/10"
        style={{ width, height }}
      />
    </span>
  );
}

export function toAspectRatioOptions(values: readonly string[]): OptionRadioItem[] {
  return values.map((value) => ({
    value,
    label: value,
    icon: <AspectShapeIcon value={value} />,
  }));
}

export function toPixelSizeOptions(values: readonly string[]): OptionRadioItem[] {
  return values.map((value) => ({
    value,
    label: value.replace(/x/i, "×"),
    icon: <AspectShapeIcon value={value} />,
  }));
}

export function toSizeTierOptions(values: readonly string[]): OptionRadioItem[] {
  return toRadioOptions(values);
}

export function toResolutionOptions(values: readonly string[]): OptionRadioItem[] {
  return toRadioOptions(values);
}
