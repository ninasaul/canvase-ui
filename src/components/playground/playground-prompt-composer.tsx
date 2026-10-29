"use client";

import {
  ArrowUp,
  At,
  Image,
  Images,
  MusicNote,
  Plus,
  Trash,
  UploadSimple,
  VideoCamera,
  X,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  PLAYGROUND_CIRCLE_ACTION_CLASS,
  PLAYGROUND_CIRCLE_ACTION_SIZE,
  PLAYGROUND_COMPOSER_FIELD_INSET_CLASS,
  playgroundComposerShellClass,
  type PlaygroundComposerSurface,
  PLAYGROUND_COMPOSER_TOOLBAR_CLASS,
  PLAYGROUND_COMPOSER_TOOLBAR_ICON_CLASS,
  PLAYGROUND_COMPOSER_TOOLBAR_ICON_SIZE,
} from "@/components/playground/playground-styles";
import { PlaygroundMediaLibraryPicker } from "@/components/playground/playground-media-library-picker";
import {
  PromptMentionEditor,
  promptMentionCaretRect,
  readPromptMentionCaret,
  serializePromptMentionEditor,
  writePromptMentionCaret,
} from "@/components/playground/prompt-mention-editor";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Popover } from "@/components/ui/popover";
import { toast } from "@/components/ui/toast";
import {
  createMediaUrlReference,
  isMediaUrlInReferences,
  MAX_MEDIA_REFERENCE_BYTES,
  type PlaygroundMediaReference,
  type PlaygroundMediaType,
} from "@/lib/playground/media-references";
import {
  fileNameFromStoredUrl,
  playgroundLibraryUploadToastMessage,
  uploadPlaygroundAssetWithMeta,
} from "@/lib/playground-media";
import {
  buildCombinedUploadAccept,
  detectPlaygroundUploadMediaType,
  type PlaygroundMediaUploadOption,
} from "@/lib/playground/media-upload";
import {
  insertPromptMentionTokens,
  mentionQueryMatchesReference,
  parseMentionAtCursor,
  promptMentionTokenForReference,
} from "@/lib/playground/prompt-mentions";
import { clampCaretAnchorRect } from "@/lib/textarea-caret";
import { messages } from "@/messages";

export type MediaUploadOption = PlaygroundMediaUploadOption;

export type PlaygroundReferenceSlotKind = "stack" | "frame";

type PlaygroundPromptComposerProps = {
  prompt: string;
  references: PlaygroundMediaReference[];
  placeholder: string;
  hint: string;
  referenceLimitMessage: string;
  getReferenceLabel: (item: PlaygroundMediaReference, index: number) => string;
  uploadOptions: MediaUploadOption[];
  canAddReference: (
    mediaType: PlaygroundMediaType,
    currentReferences?: readonly PlaygroundMediaReference[],
  ) => boolean;
  disabled?: boolean;
  loading?: boolean;
  allowReferences?: boolean;
  /** Inline slots left of the textarea (reference UX). */
  referenceSlotKind?: PlaygroundReferenceSlotKind;
  /** Frame mode: 1 = first only, 2 = first + last. */
  frameSlotCount?: 1 | 2;
  showLastFrameSlot?: boolean;
  toolbarLeading?: ReactNode;
  canClear?: boolean;
  /** `plain` when nested inside another surface (canvas node dock). */
  surface?: PlaygroundComposerSurface;
  onPromptChange: (value: string) => void;
  onReferencesChange: (references: PlaygroundMediaReference[]) => void;
  onGenerate: () => void;
  onClear?: () => void;
};

function MentionPreview({ item }: { item: PlaygroundMediaReference }) {
  if (item.mediaType === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local blob / HTTPS preview
      <img src={item.previewUrl} alt="" className="h-8 w-8 rounded object-cover" />
    );
  }
  if (item.mediaType === "video") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800">
        <Icon icon={VideoCamera} size={14} className="text-zinc-500" />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800">
      <Icon icon={MusicNote} size={14} className="text-zinc-500" />
    </div>
  );
}

function ReferencePreview({ item }: { item: PlaygroundMediaReference }) {
  if (item.mediaType === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local blob / HTTPS preview
      <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
    );
  }

  if (item.mediaType === "video") {
    return (
      <div className="relative h-full w-full bg-zinc-100 dark:bg-zinc-800">
        <video
          src={item.previewUrl}
          muted
          playsInline
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
          <Icon icon={VideoCamera} size={18} className="text-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-zinc-100 px-1 dark:bg-zinc-800">
      <Icon icon={MusicNote} size={18} className="text-zinc-500" />
      <span className="max-w-full truncate text-[9px] text-zinc-500">{item.name}</span>
    </div>
  );
}

const REFERENCE_CARD_WIDTH_PX = 60;
const REFERENCE_CARD_HEIGHT_PX = 80;
/** Horizontal gap between cards when the stack is hovered / expanded. */
const REFERENCE_EXPAND_STEP_PX = 40;
/** Target peek width (px) for each behind card while collapsed. */
const REFERENCE_COLLAPSED_PEEK_PX = 4;
/** Cap how far collapsed peeks may spread so dense stacks stay compact. */
const REFERENCE_COLLAPSED_PEEK_BUDGET_PX = 20;
const REFERENCE_STACK_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Fixed 3:4 box — empty / filled / stack must share the same outer size. */
const REFERENCE_CARD_SIZE_CLASS =
  "box-border h-[80px] w-[60px] min-w-[60px] max-w-[60px] shrink-0";

const UPLOAD_RING_RADIUS = 13;
const UPLOAD_RING_CIRCUMFERENCE = 2 * Math.PI * UPLOAD_RING_RADIUS;

function ReferenceUploadProgressSlot({ progress }: { progress: number }) {
  const clamped = Math.min(100, Math.max(0, progress));
  const dashOffset =
    UPLOAD_RING_CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div
      className={`flex ${REFERENCE_CARD_SIZE_CLASS} flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_4px_12px_-6px_rgba(0,0,0,0.2)] dark:border-zinc-700 dark:bg-zinc-900`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={messages.playground.mediaLibraryUploading.replace(
        "{progress}",
        String(clamped),
      )}
    >
      <div className="relative flex h-9 w-9 items-center justify-center">
        <svg
          className="absolute inset-0 h-9 w-9 -rotate-90"
          viewBox="0 0 36 36"
          aria-hidden
        >
          <circle
            cx="18"
            cy="18"
            r={UPLOAD_RING_RADIUS}
            fill="none"
            strokeWidth="2.5"
            className="stroke-zinc-200 dark:stroke-zinc-700"
          />
          <circle
            cx="18"
            cy="18"
            r={UPLOAD_RING_RADIUS}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={UPLOAD_RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            className="stroke-zinc-800 transition-[stroke-dashoffset] duration-200 ease-out dark:stroke-zinc-100"
          />
        </svg>
        <span className="relative tabular-nums text-[10px] font-semibold leading-none text-zinc-800 dark:text-zinc-100">
          {clamped}
        </span>
      </div>
      <span className="text-[9px] leading-none text-zinc-400">
        {messages.playground.mediaLibraryUploadShort}
      </span>
    </div>
  );
}

function ReferenceEmptySlot({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex ${REFERENCE_CARD_SIZE_CLASS} flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900/40 dark:hover:border-zinc-500 dark:hover:bg-zinc-900`}
    >
      <Icon icon={Image} size={18} className="shrink-0 text-zinc-400" />
      <span className="w-full truncate px-0.5 text-center text-[10px] leading-tight">
        {label}
      </span>
    </button>
  );
}

function ReferenceFrameFilledSlot({
  item,
  label,
  disabled,
  onRemove,
}: {
  item: PlaygroundMediaReference;
  label: string;
  disabled?: boolean;
  onRemove: () => void;
}) {
  return (
    <div className={`group relative ${REFERENCE_CARD_SIZE_CLASS} rounded-xl`}>
      <div className="h-full w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_4px_12px_-6px_rgba(0,0,0,0.2)] dark:border-zinc-700 dark:bg-zinc-900">
        <ReferencePreview item={item} />
      </div>
      <span className="pointer-events-none absolute bottom-1 left-1 max-w-[calc(100%-0.5rem)] truncate rounded-md bg-black/55 px-1 py-0.5 text-[9px] leading-none text-white">
        {label}
      </span>
      <button
        type="button"
        className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900/85 text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-zinc-100 dark:text-zinc-900"
        aria-label={messages.playground.imageReferenceRemove}
        disabled={disabled}
        onClick={onRemove}
      >
        <Icon icon={X} size={12} />
      </button>
    </div>
  );
}

/** Stable pseudo-random tilt in roughly [-6, 6] degrees from a reference id. */
function referenceStackTiltDegrees(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }
  const unit = ((hash >>> 0) % 1001) / 1000;
  return Math.round((unit * 12 - 6) * 10) / 10;
}

/** Fan / stack layout for multiple stack-mode references. */
function ReferenceStack({
  items,
  getLabel,
  canAddMore,
  disabled,
  onRemove,
  onAddMore,
}: {
  items: PlaygroundMediaReference[];
  getLabel: (item: PlaygroundMediaReference, index: number) => string;
  canAddMore?: boolean;
  disabled?: boolean;
  onRemove: (id: string) => void;
  onAddMore?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const total = items.length;
  const canExpand = total > 1;
  const showExpanded = expanded && canExpand;
  const frontIndex = total - 1;

  const tiltById = useMemo(() => {
    const next = new Map<string, number>();
    for (const item of items) {
      next.set(item.id, total === 1 ? 0 : referenceStackTiltDegrees(item.id));
    }
    return next;
  }, [items, total]);

  const collapsedPeekPx =
    total <= 1
      ? 0
      : Math.max(
          3,
          Math.min(
            REFERENCE_COLLAPSED_PEEK_PX,
            Math.round(REFERENCE_COLLAPSED_PEEK_BUDGET_PX / (total - 1)),
          ),
        );

  /**
   * Flow size must match empty / frame slots (60×80). Collapsed stack peeks
   * up-left; expand fans right. Peeks float outside this box.
   */
  const stackOffsetPx = (total - 1) * collapsedPeekPx;
  const floatingWidth = showExpanded
    ? REFERENCE_CARD_WIDTH_PX + (total - 1) * REFERENCE_EXPAND_STEP_PX + 16
    : REFERENCE_CARD_WIDTH_PX + stackOffsetPx + 8;
  const floatingHeight = showExpanded
    ? REFERENCE_CARD_HEIGHT_PX + 12
    : REFERENCE_CARD_HEIGHT_PX + stackOffsetPx + 8;

  return (
    <div
      className={`relative z-30 overflow-visible ${REFERENCE_CARD_SIZE_CLASS}`}
    >
      <div
        className="absolute z-40"
        style={{
          left: showExpanded ? 0 : -stackOffsetPx,
          top: showExpanded ? 0 : -stackOffsetPx,
          width: floatingWidth,
          height: floatingHeight,
        }}
        onMouseEnter={() => {
          if (canExpand) {
            setExpanded(true);
          }
        }}
        onMouseLeave={() => {
          setExpanded(false);
          setHoveredIndex(null);
        }}
      >
        {items.map((item, index) => {
          // Within the hit box: back → front runs down-right so peeks read up-left.
          const collapsedX = index * collapsedPeekPx;
          const collapsedY = index * collapsedPeekPx;
          const expandedX = index * REFERENCE_EXPAND_STEP_PX;
          const rotate = showExpanded ? (tiltById.get(item.id) ?? 0) : 0;
          const isCardHovered = hoveredIndex === index;
          const zIndex = isCardHovered ? 50 : index + 1;
          const isFront = index === frontIndex;

          return (
            <div
              key={item.id}
              className={`group absolute left-0 top-0 origin-bottom will-change-transform ${REFERENCE_CARD_SIZE_CLASS} rounded-xl`}
              style={{
                zIndex,
                transition: `transform 280ms ${REFERENCE_STACK_EASE}, box-shadow 280ms ${REFERENCE_STACK_EASE}`,
                transform: showExpanded
                  ? `translateX(${expandedX}px) translateY(${isCardHovered ? -5 : 0}px) rotate(${rotate}deg) scale(${isCardHovered ? 1.04 : 1})`
                  : `translateX(${collapsedX}px) translateY(${collapsedY}px) rotate(0deg) scale(1)`,
                boxShadow: isCardHovered
                  ? "0 12px 28px -10px rgba(0,0,0,0.35)"
                  : "0 4px 12px -6px rgba(0,0,0,0.2)",
              }}
              onMouseEnter={() => setHoveredIndex(index)}
            >
              <div className="h-full w-full overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                <ReferencePreview item={item} />
              </div>
              <button
                type="button"
                className="absolute -right-1.5 -top-1.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900/85 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 dark:bg-zinc-100 dark:text-zinc-900"
                aria-label={messages.playground.imageReferenceRemove}
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(item.id);
                }}
              >
                <Icon icon={X} size={12} />
              </button>
              {isFront && canAddMore && onAddMore ? (
                <button
                  type="button"
                  className="absolute -bottom-1 -right-1 z-30 inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-[transform,background-color] duration-200 hover:scale-105 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                  aria-label={messages.playground.referenceSlotAdd}
                  disabled={disabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddMore(event);
                  }}
                >
                  <Icon icon={Plus} size={12} />
                </button>
              ) : null}
              <span className="pointer-events-none sr-only">
                {getLabel(item, index)}
              </span>
            </div>
          );
        })}

        {canExpand && !showExpanded ? (
          <span
            className="pointer-events-none absolute bottom-1 left-1 z-40 inline-flex min-w-5 items-center justify-center rounded-full bg-zinc-900/80 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white dark:bg-zinc-100/90 dark:text-zinc-900"
            aria-label={messages.playground.referenceStackCount.replace(
              "{count}",
              String(total),
            )}
          >
            {total}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function PlaygroundPromptComposer({
  prompt,
  references,
  placeholder,
  hint,
  referenceLimitMessage,
  getReferenceLabel,
  uploadOptions,
  canAddReference,
  disabled,
  loading,
  allowReferences = true,
  referenceSlotKind = "stack",
  frameSlotCount = 2,
  showLastFrameSlot = true,
  toolbarLeading,
  canClear = false,
  surface = "card",
  onPromptChange,
  onReferencesChange,
  onGenerate,
  onClear,
}: PlaygroundPromptComposerProps) {
  const inputId = useId();
  const menuId = useId();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileRefs = useRef<Partial<Record<PlaygroundMediaType, HTMLInputElement | null>>>({});
  const anyFileRef = useRef<HTMLInputElement | null>(null);
  const uploadInsertMentionRef = useRef(false);
  const frameSlotTargetRef = useRef<number | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionAnchorRect, setMentionAnchorRect] = useState<DOMRect | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [pickerFrameSlot, setPickerFrameSlot] = useState<number | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addMenuAnchorRect, setAddMenuAnchorRect] = useState<DOMRect | null>(null);
  const [libraryUploading, setLibraryUploading] = useState(false);
  const [libraryUploadProgress, setLibraryUploadProgress] = useState<number | null>(
    null,
  );
  const [dragOver, setDragOver] = useState(false);

  const availableUploadOptions = useMemo(
    () =>
      uploadOptions.filter((option) =>
        canAddReference(option.mediaType, references),
      ),
    [uploadOptions, canAddReference, references],
  );
  const libraryAllowedMediaTypes = useMemo(() => {
    if (pickerFrameSlot !== null) {
      return (["image"] as const).filter((type) =>
        availableUploadOptions.some((option) => option.mediaType === type),
      );
    }
    return availableUploadOptions.map((option) => option.mediaType);
  }, [availableUploadOptions, pickerFrameSlot]);
  const librarySelectedUrls = useMemo(
    () =>
      references.flatMap((item) =>
        [item.url, item.previewUrl].filter(
          (value): value is string => Boolean(value?.trim()),
        ),
      ),
    [references],
  );
  const combinedUploadAccept = buildCombinedUploadAccept(availableUploadOptions);
  const interactionDisabled = Boolean(disabled || loading || libraryUploading);

  const filteredReferences = references.filter((item) =>
    mentionQueryMatchesReference(mentionQuery, item, references),
  );

  const showMentionMenu = mentionOpen && allowReferences;

  function updateMentionAnchor(open: boolean) {
    const element = editorRef.current;
    if (!open || !element) {
      setMentionAnchorRect(null);
      return;
    }
    setMentionAnchorRect(
      clampCaretAnchorRect(promptMentionCaretRect(element), element),
    );
  }

  function closeMentionMenu() {
    setMentionOpen(false);
    setMentionQuery("");
    setMentionAnchorRect(null);
  }

  const insertMentionsInPrompt = useCallback(
    (tokens: string[]) => {
      const cursor = editorRef.current
        ? readPromptMentionCaret(editorRef.current)
        : prompt.length;
      const { nextPrompt, nextCursor } = insertPromptMentionTokens(
        prompt,
        cursor,
        tokens,
      );
      onPromptChange(nextPrompt);
      closeMentionMenu();
      requestAnimationFrame(() => {
        const element = editorRef.current;
        if (!element) {
          return;
        }
        element.focus();
        writePromptMentionCaret(element, nextCursor);
      });
    },
    [onPromptChange, prompt],
  );

  const selectReferenceMention = useCallback(
    (item: PlaygroundMediaReference) => {
      insertMentionsInPrompt([promptMentionTokenForReference(item, references)]);
    },
    [insertMentionsInPrompt, references],
  );

  useEffect(() => {
    if (!showMentionMenu) {
      return;
    }
    updateMentionAnchor(true);
  }, [prompt, showMentionMenu, mentionQuery]);

  const addFiles = (
    files: FileList | File[],
    preferredType?: PlaygroundMediaType,
    options: { insertMention?: boolean } = {},
  ) => {
    void addFilesToLibrary(files, preferredType, options);
  };

  async function addFilesToLibrary(
    files: FileList | File[],
    preferredType?: PlaygroundMediaType,
    options: { insertMention?: boolean } = {},
  ) {
    if (!allowReferences || availableUploadOptions.length === 0 || libraryUploading) {
      return;
    }
    const shouldInsert =
      options.insertMention ?? uploadInsertMentionRef.current ?? mentionOpen;
    uploadInsertMentionRef.current = false;

    const next = [...references];
    const added: PlaygroundMediaReference[] = [];
    const candidates = Array.from(files).filter((file) => {
      const mediaType =
        preferredType ??
        detectPlaygroundUploadMediaType(file, availableUploadOptions);
      return mediaType !== null;
    });
    const total = Math.max(1, candidates.length);
    let completed = 0;

    setLibraryUploading(true);
    setLibraryUploadProgress(0);
    try {
      for (const file of Array.from(files)) {
        const mediaType =
          preferredType ??
          detectPlaygroundUploadMediaType(file, availableUploadOptions);
        if (!mediaType || !canAddReference(mediaType, next)) {
          if (
            !preferredType &&
            detectPlaygroundUploadMediaType(file, availableUploadOptions) ===
              null
          ) {
            continue;
          }
          toast.danger(referenceLimitMessage);
          break;
        }
        if (file.size > MAX_MEDIA_REFERENCE_BYTES) {
          toast.danger(messages.playground.referenceTooLarge);
          break;
        }
        try {
          const uploaded = await uploadPlaygroundAssetWithMeta(file, {
            allowedKinds: [mediaType],
            filename: file.name || mediaType,
            onProgress: (percent) => {
              const overall = Math.round(
                ((completed + percent / 100) / total) * 100,
              );
              setLibraryUploadProgress(Math.min(99, overall));
            },
          });
          completed += 1;
          setLibraryUploadProgress(
            Math.min(100, Math.round((completed / total) * 100)),
          );
          const reference = createMediaUrlReference(
            uploaded.url,
            mediaType,
            next.length,
            fileNameFromStoredUrl(uploaded.url, file.name || mediaType),
            uploaded.assetId,
          );
          added.push(reference);
          next.push(reference);
        } catch (error) {
          toast.danger(playgroundLibraryUploadToastMessage(error));
          break;
        }
      }
    } finally {
      setLibraryUploading(false);
      setLibraryUploadProgress(null);
    }

    if (added.length === 0) {
      return;
    }
    onReferencesChange(next);

    if (shouldInsert) {
      insertMentionsInPrompt(
        added.map((item) => promptMentionTokenForReference(item, next)),
      );
    }
  }

  function syncMentionState(value: string, cursor: number) {
    if (!allowReferences) {
      closeMentionMenu();
      return;
    }
    const mention = parseMentionAtCursor(value, cursor);
    setMentionOpen(mention.open);
    setMentionQuery(mention.query);
    updateMentionAnchor(mention.open);
  }

  function updatePrompt(value: string, caret: number) {
    onPromptChange(value);
    syncMentionState(value, caret);
  }

  function revokeReference(item: PlaygroundMediaReference | undefined) {
    if (item?.sourceKind === "file" && item.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }

  function removeReference(id: string) {
    const target = references.find((item) => item.id === id);
    revokeReference(target);
    onReferencesChange(references.filter((item) => item.id !== id));
  }

  async function assignFrameSlot(slotIndex: number, file: File) {
    if (libraryUploading) {
      return;
    }
    if (file.size > MAX_MEDIA_REFERENCE_BYTES) {
      toast.danger(messages.playground.referenceTooLarge);
      return;
    }
    frameSlotTargetRef.current = slotIndex;
    setPickerFrameSlot(slotIndex);
    setLibraryUploading(true);
    setLibraryUploadProgress(0);
    try {
      const uploaded = await uploadPlaygroundAssetWithMeta(file, {
        allowedKinds: ["image"],
        filename: file.name || "image",
        onProgress: (percent) => {
          setLibraryUploadProgress(Math.min(99, percent));
        },
      });
      setLibraryUploadProgress(100);
      const created = createMediaUrlReference(
        uploaded.url,
        "image",
        slotIndex,
        fileNameFromStoredUrl(uploaded.url, file.name || "image"),
        uploaded.assetId,
      );
      applyFrameSlotReference(slotIndex, created);
    } catch (error) {
      toast.danger(playgroundLibraryUploadToastMessage(error));
    } finally {
      setLibraryUploading(false);
      setLibraryUploadProgress(null);
      setPickerFrameSlot(null);
      frameSlotTargetRef.current = null;
    }
  }

  function applyFrameSlotReference(
    slotIndex: number,
    created: PlaygroundMediaReference,
  ) {
    const next = [...references];
    if (slotIndex === 0) {
      revokeReference(next[0]);
      next[0] = created;
      onReferencesChange(next.filter(Boolean));
      return;
    }
    if (next.length === 0) {
      onReferencesChange([created]);
      return;
    }
    revokeReference(next[1]);
    if (next.length === 1) {
      next.push(created);
    } else {
      next[1] = created;
    }
    onReferencesChange(next);
  }

  function openUpload(mediaType: PlaygroundMediaType, insertMention = false) {
    frameSlotTargetRef.current = null;
    setPickerFrameSlot(null);
    uploadInsertMentionRef.current = insertMention;
    fileRefs.current[mediaType]?.click();
  }

  /** Stack / empty-slot picker: one dialog for every still-available media type. */
  function openAnyUpload(insertMention = false) {
    if (availableUploadOptions.length === 0) {
      return;
    }
    if (availableUploadOptions.length === 1) {
      openUpload(availableUploadOptions[0]!.mediaType, insertMention);
      return;
    }
    frameSlotTargetRef.current = null;
    setPickerFrameSlot(null);
    uploadInsertMentionRef.current = insertMention;
    anyFileRef.current?.click();
  }

  function openFrameSlotUpload(slotIndex: number) {
    frameSlotTargetRef.current = slotIndex;
    setPickerFrameSlot(slotIndex);
    uploadInsertMentionRef.current = false;
    fileRefs.current.image?.click();
  }

  function openAddSourceMenu(
    event: MouseEvent<HTMLElement>,
    options: { frameSlot?: number; insertMention?: boolean } = {},
  ) {
    if (availableUploadOptions.length === 0) {
      return;
    }
    const frameSlot = options.frameSlot ?? null;
    frameSlotTargetRef.current = frameSlot;
    setPickerFrameSlot(frameSlot);
    uploadInsertMentionRef.current = options.insertMention ?? false;
    setAddMenuAnchorRect(event.currentTarget.getBoundingClientRect());
    setAddMenuOpen(true);
  }

  function closeAddSourceMenu() {
    setAddMenuOpen(false);
    setAddMenuAnchorRect(null);
  }

  function dismissAddSourceMenu() {
    closeAddSourceMenu();
    if (!libraryOpen) {
      setPickerFrameSlot(null);
      frameSlotTargetRef.current = null;
      uploadInsertMentionRef.current = false;
    }
  }

  function closeLibraryPicker() {
    setLibraryOpen(false);
    setPickerFrameSlot(null);
    frameSlotTargetRef.current = null;
    uploadInsertMentionRef.current = false;
  }

  function chooseUploadFromMenu() {
    const frameSlot = pickerFrameSlot;
    const insertMention = uploadInsertMentionRef.current;
    closeAddSourceMenu();
    if (frameSlot !== null) {
      openFrameSlotUpload(frameSlot);
      return;
    }
    openAnyUpload(insertMention);
  }

  function chooseLibraryFromMenu() {
    closeAddSourceMenu();
    setLibraryOpen(true);
  }

  function handleLibraryUpload() {
    const frameSlot = pickerFrameSlot;
    const insertMention = uploadInsertMentionRef.current;
    setLibraryOpen(false);
    if (frameSlot !== null) {
      openFrameSlotUpload(frameSlot);
      return;
    }
    openAnyUpload(insertMention);
  }

  function handlePickerConfirm(
    items: Array<{
      id?: string;
      url: string;
      mediaType: PlaygroundMediaType | "other";
      displayName: string;
    }>,
  ) {
    if (items.length === 0) {
      return;
    }

    if (pickerFrameSlot !== null) {
      const first = items[0];
      if (!first) {
        return;
      }
      const mediaType =
        first.mediaType === "other" ? "image" : first.mediaType;
      if (mediaType !== "image") {
        toast.danger(referenceLimitMessage);
        return;
      }
      if (
        isMediaUrlInReferences(first.url, references, {
          exceptIndex: pickerFrameSlot,
        })
      ) {
        toast.danger(messages.playground.mediaLibraryAlreadyAdded);
        return;
      }
      const created = createMediaUrlReference(
        first.url,
        "image",
        pickerFrameSlot,
        first.displayName,
        first.id,
      );
      applyFrameSlotReference(pickerFrameSlot, created);
      setPickerFrameSlot(null);
      frameSlotTargetRef.current = null;
      return;
    }

    const next = [...references];
    const added: PlaygroundMediaReference[] = [];
    for (const item of items) {
      const mediaType =
        item.mediaType === "other"
          ? availableUploadOptions[0]?.mediaType
          : item.mediaType;
      if (!mediaType) {
        continue;
      }
      if (isMediaUrlInReferences(item.url, next)) {
        continue;
      }
      if (!canAddReference(mediaType, next)) {
        if (added.length === 0) {
          toast.danger(referenceLimitMessage);
        }
        break;
      }
      const created = createMediaUrlReference(
        item.url,
        mediaType,
        next.length,
        item.displayName,
        item.id,
      );
      added.push(created);
      next.push(created);
    }

    if (added.length === 0) {
      return;
    }
    onReferencesChange(next);
    if (mentionOpen || uploadInsertMentionRef.current) {
      uploadInsertMentionRef.current = false;
      insertMentionsInPrompt(
        added.map((item) => promptMentionTokenForReference(item, next)),
      );
    }
  }

  function handleFirstMentionAction() {
    const firstReference = filteredReferences[0];
    if (firstReference) {
      selectReferenceMention(firstReference);
      return;
    }
    const firstUpload = availableUploadOptions[0];
    if (firstUpload) {
      openUpload(firstUpload.mediaType, true);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    if (interactionDisabled || !allowReferences) {
      return;
    }
    if (event.dataTransfer.files.length > 0) {
      addFiles(event.dataTransfer.files, undefined, { insertMention: mentionOpen });
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    if (!allowReferences) {
      return;
    }
    const files = event.clipboardData.files;
    if (files.length === 0) {
      return;
    }
    if (
      Array.from(files).some(
        (file) => detectPlaygroundUploadMediaType(file, availableUploadOptions) !== null,
      )
    ) {
      event.preventDefault();
      addFiles(files, undefined, { insertMention: mentionOpen });
    }
  }

  return (
    <div
      className={`playground-composer-shell ${playgroundComposerShellClass(surface)} ${dragOver ? "border-sky-400 bg-sky-50/40 dark:border-sky-600 dark:bg-sky-950/20" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!interactionDisabled && allowReferences) {
          setDragOver(true);
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!interactionDisabled && allowReferences) {
          setDragOver(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setDragOver(false);
        }
      }}
      onDrop={handleDrop}
    >
        <div
          className={`flex flex-col gap-3 pt-3 sm:flex-row sm:items-start ${PLAYGROUND_COMPOSER_FIELD_INSET_CLASS}`}
        >
          {allowReferences ? (
            <div className="relative z-30 flex shrink-0 items-start gap-2 overflow-visible">
              {referenceSlotKind === "frame" ? (
                <>
                  {libraryUploading &&
                  libraryUploadProgress !== null &&
                  pickerFrameSlot === 0 ? (
                    <ReferenceUploadProgressSlot progress={libraryUploadProgress} />
                  ) : references[0] ? (
                    <ReferenceFrameFilledSlot
                      item={references[0]}
                      label={getReferenceLabel(references[0], 0)}
                      disabled={interactionDisabled}
                      onRemove={() => removeReference(references[0]!.id)}
                    />
                  ) : (
                    <ReferenceEmptySlot
                      label={messages.playground.videoFirstFrameBadge}
                      disabled={interactionDisabled}
                      onClick={(event) => openAddSourceMenu(event, { frameSlot: 0 })}
                    />
                  )}
                  {frameSlotCount > 1 && showLastFrameSlot ? (
                    libraryUploading &&
                    libraryUploadProgress !== null &&
                    pickerFrameSlot === 1 ? (
                      <ReferenceUploadProgressSlot progress={libraryUploadProgress} />
                    ) : references[1] ? (
                      <ReferenceFrameFilledSlot
                        item={references[1]}
                        label={getReferenceLabel(references[1], 1)}
                        disabled={interactionDisabled}
                        onRemove={() => removeReference(references[1]!.id)}
                      />
                    ) : (
                      <ReferenceEmptySlot
                        label={messages.playground.videoLastFrameBadge}
                        disabled={interactionDisabled}
                        onClick={(event) => openAddSourceMenu(event, { frameSlot: 1 })}
                      />
                    )
                  ) : null}
                </>
              ) : (
                <>
                  {references.length === 0 &&
                  !(libraryUploading && libraryUploadProgress !== null) ? (
                    <ReferenceEmptySlot
                      label={messages.playground.referenceContentSlot}
                      disabled={
                        interactionDisabled || availableUploadOptions.length === 0
                      }
                      onClick={(event) => openAddSourceMenu(event)}
                    />
                  ) : references.length > 0 ? (
                    <ReferenceStack
                      items={references}
                      getLabel={getReferenceLabel}
                      canAddMore={
                        availableUploadOptions.length > 0 && !libraryUploading
                      }
                      disabled={interactionDisabled}
                      onRemove={removeReference}
                      onAddMore={(event) => openAddSourceMenu(event)}
                    />
                  ) : null}
                  {libraryUploading && libraryUploadProgress !== null ? (
                    <ReferenceUploadProgressSlot progress={libraryUploadProgress} />
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          <PromptMentionEditor
            ref={editorRef}
            id={inputId}
            value={prompt}
            references={references}
            disabled={interactionDisabled}
            placeholder={placeholder}
            ariaExpanded={mentionOpen}
            ariaControls={mentionOpen ? menuId : undefined}
            onValueChange={updatePrompt}
            onCaretChange={(caret) => {
              const live = editorRef.current
                ? serializePromptMentionEditor(editorRef.current)
                : prompt;
              syncMentionState(live, caret);
            }}
            onPaste={handlePaste}
            onKeyDown={(event) => {
              if (event.key === "Escape" && mentionOpen) {
                event.preventDefault();
                closeMentionMenu();
                return;
              }
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                onGenerate();
                return;
              }
              if (
                allowReferences &&
                event.key === "Enter" &&
                !event.shiftKey &&
                mentionOpen &&
                (filteredReferences.length > 0 || availableUploadOptions.length > 0)
              ) {
                event.preventDefault();
                handleFirstMentionAction();
              }
            }}
          />
        </div>

        <Popover
          open={showMentionMenu}
          onOpenChange={(next) => {
            if (!next) {
              closeMentionMenu();
            }
          }}
          anchorRef={editorRef}
          anchorRect={mentionAnchorRect}
          placement="top"
          id={menuId}
          ariaLabel={messages.playground.imageMentionHint}
          minWidth={260}
          maxWidth={340}
          zIndex={70}
          footer={
            availableUploadOptions.length > 0 ? (
              <div className="p-1.5">
                {availableUploadOptions.map((option) => (
                  <button
                    key={option.mediaType}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    onClick={() => openUpload(option.mediaType, true)}
                  >
                    <Icon
                      icon={
                        option.mediaType === "image"
                          ? Image
                          : option.mediaType === "video"
                            ? VideoCamera
                            : MusicNote
                      }
                      size={14}
                      className="text-zinc-400"
                    />
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  </button>
                ))}
              </div>
            ) : undefined
          }
        >
          {filteredReferences.length > 0 ? (
            <div>
              <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                {messages.playground.mentionExistingSection}
              </p>
              {filteredReferences.map((item) => {
                const token = promptMentionTokenForReference(item, references);
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => selectReferenceMention(item)}
                  >
                    <MentionPreview item={item} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs text-zinc-700 dark:text-zinc-200">
                        {token}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">
                        {item.name}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-2 py-2">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {messages.playground.mentionEmpty}
              </p>
            </div>
          )}
        </Popover>

        <div className={PLAYGROUND_COMPOSER_TOOLBAR_CLASS}>
          {toolbarLeading ? (
            <div className="min-w-0 sm:shrink">{toolbarLeading}</div>
          ) : null}
          <div className="flex min-w-0 items-center gap-1.5 sm:min-w-0 sm:flex-1">
            {allowReferences && availableUploadOptions.length > 0 ? (
              <Button
                variant="ghost"
                size={PLAYGROUND_COMPOSER_TOOLBAR_ICON_SIZE}
                className={PLAYGROUND_COMPOSER_TOOLBAR_ICON_CLASS}
                disabled={interactionDisabled}
                aria-label={messages.playground.imageMentionHint}
                title={messages.playground.imageMentionHint}
                onClick={() => {
                  const next = prompt.endsWith("@") ? prompt : `${prompt}@`;
                  onPromptChange(next);
                  requestAnimationFrame(() => {
                    const element = editorRef.current;
                    if (!element) {
                      return;
                    }
                    const cursor = next.length;
                    element.focus();
                    writePromptMentionCaret(element, cursor);
                    syncMentionState(next, cursor);
                  });
                }}
              >
                <Icon icon={At} size={15} />
              </Button>
            ) : null}
            {onClear ? (
              <Button
                variant="ghost"
                size={PLAYGROUND_COMPOSER_TOOLBAR_ICON_SIZE}
                className={PLAYGROUND_COMPOSER_TOOLBAR_ICON_CLASS}
                disabled={!canClear || interactionDisabled}
                aria-label={messages.playground.historyClear}
                title={messages.playground.historyClear}
                onClick={onClear}
              >
                <Icon icon={Trash} size={15} />
              </Button>
            ) : null}
            <p className="min-w-0 flex-1 truncate pl-0.5 text-[11px] text-zinc-400 max-sm:hidden">
              {hint}
            </p>
            <span
              className="shrink-0 tabular-nums text-[11px] text-zinc-400"
              aria-live="polite"
            >
              {messages.playground.promptCharCount.replace(
                "{count}",
                String(prompt.length),
              )}
            </span>
            <Button
              variant="primary"
              size={PLAYGROUND_CIRCLE_ACTION_SIZE}
              className={PLAYGROUND_CIRCLE_ACTION_CLASS}
              disabled={interactionDisabled || !prompt.trim()}
              aria-label={
                loading
                  ? messages.playground.generating
                  : messages.playground.generate
              }
              onClick={onGenerate}
            >
              <Icon icon={ArrowUp} size={15} />
            </Button>
          </div>
        </div>

      {allowReferences ? (
        <>
          {combinedUploadAccept ? (
            <input
              ref={anyFileRef}
              type="file"
              accept={combinedUploadAccept}
              multiple={referenceSlotKind !== "frame"}
              className="hidden"
              onChange={(event) => {
                const files = event.target.files;
                if (files?.length) {
                  addFiles(files);
                }
                event.target.value = "";
              }}
            />
          ) : null}
          {uploadOptions.map((option) => (
            <input
              key={option.mediaType}
              ref={(element) => {
                fileRefs.current[option.mediaType] = element;
              }}
              type="file"
              accept={option.accept}
              multiple={option.mediaType === "image" && referenceSlotKind !== "frame"}
              className="hidden"
              onChange={(event) => {
                const files = event.target.files;
                if (files?.length) {
                  const slot = frameSlotTargetRef.current;
                  if (
                    slot !== null &&
                    option.mediaType === "image" &&
                    referenceSlotKind === "frame"
                  ) {
                    const file = files[0];
                    if (file) {
                      assignFrameSlot(slot, file);
                    }
                    frameSlotTargetRef.current = null;
                  } else {
                    addFiles(files, option.mediaType);
                  }
                }
                event.target.value = "";
              }}
            />
          ))}
        </>
      ) : null}

      <Popover
        open={addMenuOpen}
        onOpenChange={(next) => {
          if (!next) {
            dismissAddSourceMenu();
          }
        }}
        anchorRect={addMenuAnchorRect}
        placement="bottom"
        ariaLabel={messages.playground.mediaLibraryChooseTitle}
        minWidth={200}
        maxWidth={260}
        zIndex={80}
      >
        <div className="py-1">
          <p className="px-2.5 pb-1 pt-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
            {messages.playground.mediaLibraryChooseTitle}
          </p>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            onClick={chooseUploadFromMenu}
          >
            <Icon icon={UploadSimple} size={14} className="text-zinc-400" />
            <span>{messages.playground.mediaLibraryChooseUpload}</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            onClick={chooseLibraryFromMenu}
          >
            <Icon icon={Images} size={14} className="text-zinc-400" />
            <span>{messages.playground.mediaLibraryChooseLibrary}</span>
          </button>
        </div>
      </Popover>

      <PlaygroundMediaLibraryPicker
        open={libraryOpen}
        onClose={closeLibraryPicker}
        allowedMediaTypes={libraryAllowedMediaTypes}
        maxSelection={pickerFrameSlot !== null ? 1 : undefined}
        selectedUrls={librarySelectedUrls}
        onConfirm={handlePickerConfirm}
        onUpload={handleLibraryUpload}
      />
    </div>
  );
}
