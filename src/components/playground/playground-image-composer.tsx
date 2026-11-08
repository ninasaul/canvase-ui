"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import {
  PlaygroundPromptComposer,
  type MediaUploadOption,
} from "@/components/playground/playground-prompt-composer";
import {
  imageReferenceToMedia,
  mediaToImageReference,
  type PlaygroundMediaReference,
} from "@/lib/playground/media-references";
import {
  getImageReferenceLimit,
  type ImagePlaygroundModel,
} from "@canvase/generation-params/image";
import { type PlaygroundImageReference } from "@/lib/playground/image-references";
import { PLAYGROUND_IMAGE_ACCEPT } from "@/lib/playground-media";
import { messages } from "@/messages";

type PlaygroundImageComposerProps = {
  model: ImagePlaygroundModel;
  prompt: string;
  references: PlaygroundImageReference[];
  disabled?: boolean;
  loading?: boolean;
  toolbarLeading?: ReactNode;
  footerTrailing?: ReactNode;
  canClear?: boolean;
  surface?: "card" | "plain";
  onPromptChange: (value: string) => void;
  onReferencesChange: (references: PlaygroundImageReference[]) => void;
  onGenerate: () => void;
  onClear?: () => void;
};

export function PlaygroundImageComposer({
  model,
  references,
  onReferencesChange,
  toolbarLeading,
  footerTrailing,
  ...props
}: PlaygroundImageComposerProps) {
  const maxReferences = getImageReferenceLimit(model);
  const mediaReferences = useMemo(
    () => references.map(imageReferenceToMedia),
    [references],
  );

  const uploadOptions = useMemo<MediaUploadOption[]>(
    () =>
      maxReferences > 0
        ? [
            {
              mediaType: "image",
              accept: PLAYGROUND_IMAGE_ACCEPT,
              label: messages.playground.imageMentionUpload,
            },
          ]
        : [],
    [maxReferences],
  );

  const canAddReference = useCallback(
    (
      mediaType: "image" | "video" | "audio",
      currentReferences: readonly PlaygroundMediaReference[] = mediaReferences,
    ) => mediaType === "image" && currentReferences.length < maxReferences,
    [maxReferences, mediaReferences],
  );

  const handleReferencesChange = useCallback(
    (next: ReturnType<typeof imageReferenceToMedia>[]) => {
      onReferencesChange(next.map(mediaToImageReference));
    },
    [onReferencesChange],
  );

  return (
    <PlaygroundPromptComposer
      {...props}
      references={mediaReferences}
      toolbarLeading={toolbarLeading}
      footerTrailing={footerTrailing}
      uploadOptions={uploadOptions}
      allowReferences={maxReferences > 0}
      referenceSlotKind="stack"
      canAddReference={canAddReference}
      placeholder={
        maxReferences > 0
          ? messages.playground.imagePromptPlaceholder
          : messages.playground.imagePromptPlaceholderNoRef
      }
      hint={
        maxReferences > 0
          ? messages.playground.imageComposerHint
          : messages.playground.imageComposerHintNoRef
      }
      referenceLimitMessage={messages.playground.imageReferenceLimit.replace(
        "{count}",
        String(maxReferences),
      )}
      getReferenceLabel={(item) => item.name}
      onReferencesChange={handleReferencesChange}
    />
  );
}
