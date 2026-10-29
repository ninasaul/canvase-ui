/** UI mention tokens (`@图片1`, `@Image2`, `@视频1`, …) stripped before upstream calls. */
export const PROMPT_MENTION_TOKEN_SOURCE =
  "@(?:图片|Image|视频|Video|音频|Audio)\\d+";

export function stripPromptMentionTokens(prompt: string): string {
  return prompt
    .replace(new RegExp(PROMPT_MENTION_TOKEN_SOURCE, "gi"), " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .trim();
}
