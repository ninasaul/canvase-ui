import type {
  PlaygroundMediaReference,
  PlaygroundMediaType,
} from "@/lib/playground/media-references";
import { messages } from "@/messages";

/** UI mention tokens (`@图片1`, `@Image2`, `@视频1`, …). */
export const PROMPT_MENTION_TOKEN_SOURCE =
  "@(?:图片|Image|视频|Video|音频|Audio)\\d+";

export type PromptMentionSegment =
  | { type: "text"; text: string }
  | { type: "mention"; token: string };

export function splitPromptMentionSegments(prompt: string): PromptMentionSegment[] {
  const segments: PromptMentionSegment[] = [];
  const pattern = new RegExp(PROMPT_MENTION_TOKEN_SOURCE, "gi");
  let last = 0;
  for (const match of prompt.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) {
      segments.push({ type: "text", text: prompt.slice(last, index) });
    }
    segments.push({ type: "mention", token: match[0] });
    last = index + match[0].length;
  }
  if (last < prompt.length) {
    segments.push({ type: "text", text: prompt.slice(last) });
  }
  return segments;
}

export function parsePromptMentionToken(
  token: string,
): { mediaType: PlaygroundMediaType; index: number } | null {
  const match = /^@(图片|Image|视频|Video|音频|Audio)(\d+)$/i.exec(token);
  if (!match) {
    return null;
  }
  const kind = match[1]!.toLowerCase();
  const mediaType: PlaygroundMediaType =
    kind === "图片" || kind === "image"
      ? "image"
      : kind === "视频" || kind === "video"
        ? "video"
        : "audio";
  return { mediaType, index: Number(match[2]) };
}

export function referenceForMentionToken(
  token: string,
  references: readonly PlaygroundMediaReference[],
): PlaygroundMediaReference | undefined {
  const parsed = parsePromptMentionToken(token);
  if (!parsed) {
    return undefined;
  }
  return references.filter((item) => item.mediaType === parsed.mediaType)[
    parsed.index - 1
  ];
}

export type MentionChipPlanItem = {
  token: string;
  mediaType: PlaygroundMediaType | null;
  previewUrl: string | null;
};

export function mentionChipPlan(
  prompt: string,
  references: readonly PlaygroundMediaReference[],
): MentionChipPlanItem[] {
  const plan: MentionChipPlanItem[] = [];
  for (const segment of splitPromptMentionSegments(prompt)) {
    if (segment.type !== "mention") {
      continue;
    }
    const reference = referenceForMentionToken(segment.token, references);
    plan.push({
      token: segment.token,
      mediaType: reference?.mediaType ?? null,
      previewUrl: reference?.previewUrl ?? null,
    });
  }
  return plan;
}

export function mentionChipPlanKey(
  prompt: string,
  references: readonly PlaygroundMediaReference[],
): string {
  return mentionChipPlan(prompt, references)
    .map((item) => `${item.token}\t${item.mediaType ?? ""}\t${item.previewUrl ?? ""}`)
    .join("\n");
}

export function mentionSegmentLength(segment: PromptMentionSegment): number {
  return segment.type === "text" ? segment.text.length : segment.token.length;
}

/** Map a string offset onto a segment. Offsets inside a mention snap to its edges. */
export function segmentAtCaret(
  segments: readonly PromptMentionSegment[],
  offset: number,
): { segmentIndex: number; offsetInSegment: number } {
  if (segments.length === 0) {
    return { segmentIndex: 0, offsetInSegment: 0 };
  }
  let remaining = Math.max(0, offset);
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!;
    const length = mentionSegmentLength(segment);
    const isLast = index === segments.length - 1;
    if (remaining < length || isLast) {
      if (segment.type === "mention") {
        return {
          segmentIndex: index,
          offsetInSegment: remaining <= 0 ? 0 : length,
        };
      }
      return {
        segmentIndex: index,
        offsetInSegment: Math.min(Math.max(remaining, 0), length),
      };
    }
    remaining -= length;
  }
  const last = segments.length - 1;
  return {
    segmentIndex: last,
    offsetInSegment: mentionSegmentLength(segments[last]!),
  };
}

export function caretOffsetForSegment(
  segments: readonly PromptMentionSegment[],
  segmentIndex: number,
  offsetInSegment: number,
): number {
  let total = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!;
    const length = mentionSegmentLength(segment);
    if (index === segmentIndex) {
      if (segment.type === "mention") {
        return total + (offsetInSegment <= 0 ? 0 : length);
      }
      return total + Math.min(Math.max(offsetInSegment, 0), length);
    }
    total += length;
  }
  return total;
}

export function promptMentionToken(
  mediaType: PlaygroundMediaType,
  indexWithinType: number,
): string {
  const prefix =
    mediaType === "image"
      ? messages.playground.mentionTokenImage
      : mediaType === "video"
        ? messages.playground.mentionTokenVideo
        : messages.playground.mentionTokenAudio;
  return `@${prefix}${indexWithinType}`;
}

export function promptMentionTokenForReference(
  reference: PlaygroundMediaReference,
  references: readonly PlaygroundMediaReference[],
): string {
  const indexWithinType =
    references
      .filter((item) => item.mediaType === reference.mediaType)
      .findIndex((item) => item.id === reference.id) + 1;
  return promptMentionToken(reference.mediaType, indexWithinType);
}

export function parseMentionAtCursor(
  text: string,
  cursor: number,
): { open: boolean; query: string; start: number } {
  const before = text.slice(0, cursor);
  const match = before.match(/@([^\s@]*)$/);
  if (!match) {
    return { open: false, query: "", start: cursor };
  }
  return {
    open: true,
    query: match[1] ?? "",
    start: cursor - match[0].length,
  };
}

export function insertPromptMentionTokens(
  prompt: string,
  cursor: number,
  tokens: string[],
): { nextPrompt: string; nextCursor: number } {
  const mention = parseMentionAtCursor(prompt, cursor);
  const payload = tokens.join(" ");
  if (!payload) {
    return { nextPrompt: prompt, nextCursor: cursor };
  }

  if (mention.open) {
    const nextPrompt =
      prompt.slice(0, mention.start) + `${payload} ` + prompt.slice(cursor);
    const nextCursor = mention.start + payload.length + 1;
    return { nextPrompt, nextCursor };
  }

  const nextPrompt = `${prompt}${payload} `;
  return { nextPrompt, nextCursor: nextPrompt.length };
}

export function mentionQueryMatchesReference(
  query: string,
  reference: PlaygroundMediaReference,
  references: readonly PlaygroundMediaReference[],
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const token = promptMentionTokenForReference(reference, references).toLowerCase();
  const typeLabel =
    reference.mediaType === "image"
      ? messages.playground.mentionTokenImage.toLowerCase()
      : reference.mediaType === "video"
        ? messages.playground.mentionTokenVideo.toLowerCase()
        : messages.playground.mentionTokenAudio.toLowerCase();

  return (
    token.includes(normalized) ||
    typeLabel.includes(normalized) ||
    reference.name.toLowerCase().includes(normalized)
  );
}

export function mentionQueryMatchesUploadOption(
  query: string,
  mediaType: PlaygroundMediaType,
  label: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  const typeLabel =
    mediaType === "image"
      ? messages.playground.mentionTokenImage.toLowerCase()
      : mediaType === "video"
        ? messages.playground.mentionTokenVideo.toLowerCase()
        : messages.playground.mentionTokenAudio.toLowerCase();
  return (
    typeLabel.includes(normalized) ||
    label.toLowerCase().includes(normalized) ||
    "upload".includes(normalized) ||
    normalized.includes("upload")
  );
}

/**
 * Remove UI mention tokens (`@图片1`, `@Image2`, …) before calling `/v1`.
 * Reference images are sent via `image` / `images`, not prompt text.
 */
export function stripPromptMentionTokens(prompt: string): string {
  return prompt
    .replace(new RegExp(PROMPT_MENTION_TOKEN_SOURCE, "gi"), " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .trim();
}
