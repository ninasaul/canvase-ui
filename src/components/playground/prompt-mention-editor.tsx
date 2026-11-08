"use client";

import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import type { PlaygroundMediaReference } from "@/lib/playground/media-references";
import {
  mentionChipPlanKey,
  referenceForMentionToken,
  segmentAtCaret,
  splitPromptMentionSegments,
} from "@/lib/playground/prompt-mentions";

const EDITOR_MAX_HEIGHT_PX = 320;

const CHIP_CLASS =
  "mx-0.5 inline-flex select-none items-center gap-1 rounded-md bg-zinc-100 py-0.5 pl-0.5 pr-1 align-middle text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";

type PromptMentionEditorProps = {
  value: string;
  references: readonly PlaygroundMediaReference[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  ariaExpanded?: boolean;
  ariaControls?: string;
  onValueChange: (value: string, caret: number) => void;
  onCaretChange?: (caret: number) => void;
  onPaste?: (event: ClipboardEvent<HTMLDivElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
};

export const PromptMentionEditor = forwardRef<HTMLDivElement, PromptMentionEditorProps>(
  function PromptMentionEditor(
    {
      value,
      references,
      placeholder,
      disabled = false,
      id,
      className = "",
      ariaExpanded,
      ariaControls,
      onValueChange,
      onCaretChange,
      onPaste,
      onKeyDown,
    },
    ref,
  ) {
    const innerRef = useRef<HTMLDivElement | null>(null);
    const composingRef = useRef(false);
    const [composing, setComposing] = useState(false);
    const pendingCaretRef = useRef<number | null>(null);
    const valueRef = useRef(value);
    const onValueChangeRef = useRef(onValueChange);
    const onCaretChangeRef = useRef(onCaretChange);
    valueRef.current = value;
    onValueChangeRef.current = onValueChange;
    onCaretChangeRef.current = onCaretChange;

    const setNode = useCallback(
      (node: HTMLDivElement | null) => {
        innerRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    useLayoutEffect(() => {
      const root = innerRef.current;
      if (!root || composingRef.current) {
        return;
      }
      if (!shouldRepaintMentionEditor(root, value, references)) {
        pendingCaretRef.current = null;
        syncMentionEditorHeight(root);
        return;
      }
      const caret = pendingCaretRef.current ?? readPromptMentionCaret(root);
      pendingCaretRef.current = null;
      paintPromptMentionEditor(root, value, references);
      writePromptMentionCaret(root, caret);
      syncMentionEditorHeight(root);
    }, [references, value]);

    function emitFromDom() {
      const root = innerRef.current;
      if (!root) {
        return;
      }
      const next = serializePromptMentionEditor(root);
      const caret = readPromptMentionCaret(root);
      if (next !== valueRef.current) {
        onValueChangeRef.current(next, caret);
      }
      onCaretChangeRef.current?.(caret);
      syncMentionEditorHeight(root);
    }

    function insertPlainText(text: string) {
      const root = innerRef.current;
      if (!root) {
        return;
      }
      root.focus();
      const inserted = document.execCommand("insertText", false, text);
      if (inserted) {
        return;
      }
      const caret = readPromptMentionCaret(root);
      const current = serializePromptMentionEditor(root);
      pendingCaretRef.current = caret + text.length;
      onValueChangeRef.current(
        current.slice(0, caret) + text + current.slice(caret),
        caret + text.length,
      );
    }

    return (
      <div className={`relative min-w-0 flex-1 ${className}`.trim()}>
        {value.length === 0 && !composing ? (
          <span className="pointer-events-none absolute top-1 left-0 text-sm leading-[1.65] text-zinc-400 dark:text-zinc-500">
            {placeholder}
          </span>
        ) : null}
        <div
          ref={setNode}
          id={id}
          role="textbox"
          aria-multiline="true"
          aria-disabled={disabled || undefined}
          aria-expanded={ariaExpanded}
          aria-controls={ariaControls}
          contentEditable={disabled ? "false" : "true"}
          suppressContentEditableWarning
          className={`min-h-30 max-h-80 overflow-y-auto pr-1 pt-0.5 pb-1 text-sm leading-[1.65] whitespace-pre-wrap wrap-break-word text-zinc-800 outline-none dark:text-zinc-100 ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          onCompositionStart={() => {
            composingRef.current = true;
            setComposing(true);
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
            setComposing(false);
            emitFromDom();
          }}
          onInput={() => {
            if (composingRef.current) {
              return;
            }
            emitFromDom();
          }}
          onClick={() => {
            const root = innerRef.current;
            if (!root) {
              return;
            }
            onCaretChangeRef.current?.(readPromptMentionCaret(root));
          }}
          onKeyUp={() => {
            const root = innerRef.current;
            if (!root || composingRef.current) {
              return;
            }
            onCaretChangeRef.current?.(readPromptMentionCaret(root));
          }}
          onPaste={(event) => {
            onPaste?.(event);
            if (event.defaultPrevented) {
              return;
            }
            const text = event.clipboardData.getData("text/plain");
            event.preventDefault();
            if (text) {
              insertPlainText(text);
            }
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (event.defaultPrevented || event.nativeEvent.isComposing) {
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              insertPlainText("\n");
              return;
            }
            if (event.key === "Backspace") {
              const root = innerRef.current;
              const chip = root ? mentionChipBeforeCaret(root) : null;
              if (!root || !chip) {
                return;
              }
              event.preventDefault();
              const caret = readPromptMentionCaret(root);
              const tokenLength = chip.dataset.mentionToken?.length ?? 0;
              chip.remove();
              writePromptMentionCaret(root, Math.max(0, caret - tokenLength));
              emitFromDom();
            }
          }}
        />
      </div>
    );
  },
);

function syncMentionEditorHeight(root: HTMLElement) {
  root.style.height = "auto";
  root.style.height = `${Math.min(root.scrollHeight, EDITOR_MAX_HEIGHT_PX)}px`;
}

function shouldRepaintMentionEditor(
  root: HTMLElement,
  value: string,
  references: readonly PlaygroundMediaReference[],
): boolean {
  if (root.dataset.mentionReady !== "1") {
    return true;
  }
  if (value.length === 0 && root.querySelector("[data-placeholder]") === null) {
    return true;
  }
  if (serializePromptMentionEditor(root) !== value) {
    return true;
  }
  return readMentionChipPlanKey(root) !== mentionChipPlanKey(value, references);
}

function readMentionChipPlanKey(root: HTMLElement): string {
  return [...root.querySelectorAll<HTMLElement>("[data-mention-token]")]
    .map(
      (element) =>
        `${element.dataset.mentionToken ?? ""}\t${element.dataset.mediaType ?? ""}\t${element.dataset.previewUrl ?? ""}`,
    )
    .join("\n");
}

export function serializePromptMentionEditor(root: HTMLElement): string {
  return serializeMentionChildren(root);
}

function serializeMentionChildren(parent: Node): string {
  let text = "";
  const children = Array.from(parent.childNodes);
  for (const node of children) {
    if (node instanceof HTMLElement && node.dataset.mentionToken) {
      text += node.dataset.mentionToken;
      continue;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
      continue;
    }
    if (node instanceof HTMLBRElement) {
      if (node.dataset.placeholder === "true") {
        continue;
      }
      text += "\n";
      continue;
    }
    if (node instanceof HTMLElement && (node.tagName === "DIV" || node.tagName === "P")) {
      if (text.length > 0) {
        text += "\n";
      }
      const inner = serializeMentionChildren(node);
      text += inner === "\n" ? "" : inner;
      continue;
    }
    if (node instanceof HTMLElement) {
      text += serializeMentionChildren(node);
    }
  }
  return text;
}

function paintPromptMentionEditor(
  root: HTMLElement,
  value: string,
  references: readonly PlaygroundMediaReference[],
) {
  const fragment = document.createDocumentFragment();
  const segments = splitPromptMentionSegments(value);
  if (segments.length === 0) {
    const line = document.createElement("br");
    line.dataset.placeholder = "true";
    fragment.appendChild(line);
  } else {
    for (const segment of segments) {
      if (segment.type === "text") {
        fragment.appendChild(document.createTextNode(segment.text));
        continue;
      }
      fragment.appendChild(createMentionChip(segment.token, references));
    }
  }
  root.replaceChildren(fragment);
  root.dataset.mentionReady = "1";
}

function createMentionChip(
  token: string,
  references: readonly PlaygroundMediaReference[],
): HTMLSpanElement {
  const chip = document.createElement("span");
  const reference = referenceForMentionToken(token, references);
  chip.dataset.mentionToken = token;
  chip.dataset.mediaType = reference?.mediaType ?? "";
  chip.dataset.previewUrl = reference?.previewUrl ?? "";
  chip.contentEditable = "false";
  chip.draggable = false;
  chip.className = CHIP_CLASS;

  if (reference?.mediaType === "image" && reference.previewUrl) {
    chip.appendChild(createThumbImage(reference.previewUrl));
  } else if (reference?.mediaType === "video" && reference.previewUrl) {
    chip.appendChild(createThumbVideo(reference.previewUrl));
  } else if (reference?.mediaType === "audio") {
    chip.appendChild(createAudioMark());
  }

  const label = document.createElement("span");
  label.textContent = token;
  label.className = "font-mono text-xs leading-none";
  chip.appendChild(label);
  return chip;
}

function createThumbImage(src: string): HTMLImageElement {
  const image = document.createElement("img");
  image.src = src;
  image.alt = "";
  image.draggable = false;
  image.className = "pointer-events-none h-[18px] w-[18px] rounded object-cover";
  return image;
}

function createThumbVideo(src: string): HTMLVideoElement {
  const video = document.createElement("video");
  video.src = src;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.draggable = false;
  video.className = "pointer-events-none h-[18px] w-[18px] rounded object-cover";
  video.addEventListener(
    "loadeddata",
    () => {
      if (video.currentTime < 0.05) {
        video.currentTime = 0.05;
      }
    },
    { once: true },
  );
  return video;
}

function createAudioMark(): HTMLSpanElement {
  const mark = document.createElement("span");
  mark.className =
    "pointer-events-none flex h-[18px] w-[18px] items-center justify-center rounded bg-zinc-200 text-[11px] leading-none text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300";
  mark.textContent = "♪";
  return mark;
}

export function readPromptMentionCaret(root: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return serializePromptMentionEditor(root).length;
  }
  const range = selection.getRangeAt(0);
  if (!root.contains(range.endContainer)) {
    return serializePromptMentionEditor(root).length;
  }
  const probe = document.createRange();
  try {
    probe.setStart(root, 0);
    probe.setEnd(range.endContainer, range.endOffset);
  } catch {
    return serializePromptMentionEditor(root).length;
  }
  const holder = document.createElement("div");
  holder.appendChild(probe.cloneContents());
  return serializePromptMentionEditor(holder).length;
}

export function promptMentionCaretRect(root: HTMLElement): DOMRect {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !root.contains(selection.anchorNode)) {
    return root.getBoundingClientRect();
  }
  const range = selection.getRangeAt(0);
  const rects = range.getClientRects();
  if (rects.length > 0) {
    return rects[rects.length - 1]!;
  }
  const rect = range.getBoundingClientRect();
  if (rect.height > 0 || rect.width > 0) {
    return rect;
  }
  return root.getBoundingClientRect();
}

export function writePromptMentionCaret(root: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const segments = splitPromptMentionSegments(serializePromptMentionEditor(root));
  const location = segmentAtCaret(segments, offset);
  const range = document.createRange();
  const nodes = segmentNodes(root);
  if (nodes.length === 0 || segments.length === 0) {
    range.setStart(root, 0);
    range.collapse(true);
  } else {
    const index = Math.min(location.segmentIndex, nodes.length - 1);
    const node = nodes[index]!;
    const segment = segments[index];
    if (!segment || segment.type === "mention" || node.nodeType !== Node.TEXT_NODE) {
      const parent = node.parentNode ?? root;
      const childIndex = Array.prototype.indexOf.call(parent.childNodes, node);
      const after = segment?.type === "mention" && location.offsetInSegment > 0;
      range.setStart(parent, childIndex + (after ? 1 : 0));
      range.collapse(true);
    } else {
      const textOffset = Math.min(
        location.offsetInSegment,
        node.textContent?.length ?? 0,
      );
      range.setStart(node, textOffset);
      range.collapse(true);
    }
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

function segmentNodes(root: HTMLElement): Node[] {
  const nodes: Node[] = [];
  for (const node of Array.from(root.childNodes)) {
    if (node instanceof HTMLBRElement && node.dataset.placeholder === "true") {
      continue;
    }
    nodes.push(node);
  }
  return nodes;
}

function mentionChipBeforeCaret(root: HTMLElement): HTMLElement | null {
  const selection = window.getSelection();
  if (!selection || !selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer)) {
    return null;
  }
  if (range.startContainer === root) {
    const previous = root.childNodes[range.startOffset - 1];
    return chipElement(previous);
  }
  if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset === 0) {
    return chipElement(range.startContainer.previousSibling);
  }
  return null;
}

function chipElement(node: Node | null | undefined): HTMLElement | null {
  if (node instanceof HTMLElement && node.dataset.mentionToken) {
    return node;
  }
  return null;
}
