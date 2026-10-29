"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import {
  PlaygroundPromptComposer,
  type MediaUploadOption,
} from "@/components/playground/playground-prompt-composer";
import { PlaygroundReferenceModeSelect } from "@/components/playground/playground-reference-mode-select";
import {
  canAddMediaReference,
  type PlaygroundMediaReference,
  type PlaygroundMediaType,
  type VideoReferenceMode,
} from "@/lib/playground/media-references";
import {
  resolveVideoReferenceMode,
  type VideoCapabilityProfile,
} from "@canvase/generation-params/video";
import {
  PLAYGROUND_AUDIO_ACCEPT,
  PLAYGROUND_IMAGE_ACCEPT,
  PLAYGROUND_VIDEO_ACCEPT,
} from "@/lib/playground-media";
import { messages } from "@/messages";

type PlaygroundVideoComposerProps = {
  prompt: string;
  references: PlaygroundMediaReference[];
  referenceMode: VideoReferenceMode;
  profile: VideoCapabilityProfile;
  disabled?: boolean;
  loading?: boolean;
  toolbarLeading?: ReactNode;
  canClear?: boolean;
  surface?: "card" | "plain";
  onPromptChange: (value: string) => void;
  onReferencesChange: (references: PlaygroundMediaReference[]) => void;
  onReferenceModeChange: (mode: VideoReferenceMode) => void;
  onGenerate: () => void;
  onClear?: () => void;
};

export function PlaygroundVideoComposer({
  profile,
  referenceMode,
  references,
  disabled,
  loading,
  toolbarLeading,
  onReferenceModeChange,
  ...props
}: PlaygroundVideoComposerProps) {
  const effectiveReferenceMode = resolveVideoReferenceMode(
    profile,
    referenceMode,
  );
  const useStack = effectiveReferenceMode === "omni";
  const showLastFrameSlot = profile.supportsLastFrame;
  const frameSlotCount = profile.supportsLastFrame
    ? 2
    : profile.supportsFirstFrame
      ? 1
      : 0;

  const uploadOptions = useMemo<MediaUploadOption[]>(() => {
    const options: MediaUploadOption[] = [
      {
        mediaType: "image",
        accept: PLAYGROUND_IMAGE_ACCEPT,
        label: messages.playground.videoReferenceImageUpload,
      },
    ];
    if (useStack && profile.supportsReferenceVideos) {
      options.push({
        mediaType: "video",
        accept: PLAYGROUND_VIDEO_ACCEPT,
        label: messages.playground.videoReferenceVideoUpload,
      });
    }
    if (useStack && profile.supportsReferenceAudio) {
      options.push({
        mediaType: "audio",
        accept: PLAYGROUND_AUDIO_ACCEPT,
        label: messages.playground.videoReferenceAudioUpload,
      });
    }
    return options;
  }, [
    profile.supportsReferenceAudio,
    profile.supportsReferenceVideos,
    useStack,
  ]);

  const canAddReference = useCallback(
    (
      mediaType: PlaygroundMediaType,
      currentReferences: readonly PlaygroundMediaReference[] = references,
    ) =>
      canAddMediaReference(
        currentReferences,
        mediaType,
        effectiveReferenceMode,
        profile.referenceLimits,
      ),
    [effectiveReferenceMode, profile.referenceLimits, references],
  );

  const getReferenceLabel = useCallback(
    (item: PlaygroundMediaReference, index: number) => {
      if (!useStack) {
        if (index === 0) {
          return messages.playground.videoFirstFrameBadge;
        }
        return messages.playground.videoLastFrameBadge;
      }
      return item.name;
    },
    [useStack],
  );

  const hint = useStack
    ? profile.supportsOmniReference
      ? messages.playground.videoComposerHintOmni
      : messages.playground.videoComposerHintReference
    : messages.playground.videoComposerHintFrame;

  const placeholder = useStack
    ? profile.supportsOmniReference
      ? messages.playground.videoPromptPlaceholderOmni
      : messages.playground.videoPromptPlaceholderReference
    : messages.playground.videoPromptPlaceholderFrame;

  const referenceModeControl = profile.supportsOmniReference ? (
    <PlaygroundReferenceModeSelect
      value={referenceMode}
      disabled={disabled || loading}
      onChange={onReferenceModeChange}
    />
  ) : null;

  const mergedToolbarLeading = referenceModeControl ? (
    <div className="flex min-w-0 items-center gap-1.5">
      {toolbarLeading}
      {referenceModeControl}
    </div>
  ) : (
    toolbarLeading
  );

  return (
    <PlaygroundPromptComposer
      {...props}
      references={references}
      disabled={disabled}
      loading={loading}
      allowReferences={
        profile.supportsFirstFrame ||
        profile.supportsLastFrame ||
        profile.supportsReferenceImages
      }
      referenceSlotKind={useStack ? "stack" : "frame"}
      frameSlotCount={useStack ? undefined : (frameSlotCount as 1 | 2)}
      showLastFrameSlot={showLastFrameSlot}
      toolbarLeading={mergedToolbarLeading}
      uploadOptions={uploadOptions}
      canAddReference={canAddReference}
      placeholder={placeholder}
      hint={hint}
      referenceLimitMessage={messages.playground.videoReferenceLimit}
      getReferenceLabel={getReferenceLabel}
    />
  );
}
