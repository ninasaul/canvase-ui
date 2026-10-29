import {
  parseColonRatio,
  parsePixelSize,
} from "@/lib/playground/size-option-icons";

/** Snapshot a display aspect hint from image/video params at submit time. */
export function resolvePlaygroundDisplayAspect(
  mode: "image" | "video",
  params: {
    size?: string;
    aspectRatio?: string;
    ratio?: string;
  },
): string {
  if (mode === "video") {
    const ratio = params.ratio?.trim() ?? "";
    if (parseColonRatio(ratio)) {
      return ratio;
    }
    return "16:9";
  }

  for (const raw of [params.size, params.aspectRatio]) {
    const value = raw?.trim() ?? "";
    if (!value) {
      continue;
    }
    if (parseColonRatio(value) || parsePixelSize(value)) {
      return value;
    }
  }
  return "1:1";
}

function resolveAspectParts(
  hint: string | undefined,
  mode: "image" | "video",
): { w: number; h: number } {
  return (
    parseColonRatio(hint ?? "") ??
    parsePixelSize(hint ?? "") ??
    (mode === "video" ? { w: 16, h: 9 } : { w: 1, h: 1 })
  );
}

/** CSS `aspect-ratio` value for loading placeholders. */
export function cssAspectRatioValue(
  hint: string | undefined,
  mode: "image" | "video",
): string {
  const { w, h } = resolveAspectParts(hint, mode);
  return `${w} / ${h}`;
}

/**
 * Waiting-frame box style that keeps aspect under both max-width and max-height
 * (plain `width:100%` + `max-height` would squash the ratio).
 */
export function waitingFrameBoxStyle(
  hint: string | undefined,
  mode: "image" | "video",
  inline: boolean,
): {
  aspectRatio: string;
  width: string;
  maxHeight: string;
  height: "auto";
} {
  const { w, h } = resolveAspectParts(hint, mode);
  const maxHeight = inline ? "min(48vh, 28rem)" : "min(72vh, 36rem)";
  const maxWidthCap = inline ? "36rem" : "32rem";
  return {
    aspectRatio: `${w} / ${h}`,
    maxHeight,
    height: "auto",
    width: `min(100%, ${maxWidthCap}, calc((${maxHeight}) * ${w} / ${h}))`,
  };
}
