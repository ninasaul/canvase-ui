"use client";

import { UploadSimple } from "@phosphor-icons/react";
import { useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  fileToDataUrl,
  PLAYGROUND_CHAT_MEDIA_ACCEPT,
} from "@/lib/playground-media";
import { messages } from "@/messages";
import { toast } from "@/components/ui/toast";

type PlaygroundReferenceFieldProps = {
  label: string;
  hint?: string;
  urlValue: string;
  onUrlChange: (value: string) => void;
  allowFile?: boolean;
  multiline?: boolean;
};

function previewUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || multilineHasMany(trimmed)) {
    return null;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("data:image/") && trimmed.length < 500_000) {
    return trimmed;
  }
  return null;
}

function multilineHasMany(value: string): boolean {
  return value.split("\n").filter(Boolean).length > 1;
}

export function PlaygroundReferenceField({
  label,
  hint,
  urlValue,
  onUrlChange,
  allowFile = true,
  multiline = false,
}: PlaygroundReferenceFieldProps) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const thumb = !multiline ? previewUrl(urlValue) : null;

  async function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      if (multiline) {
        onUrlChange(urlValue.trim() ? `${urlValue.trim()}\n${dataUrl}` : dataUrl);
      } else {
        onUrlChange(dataUrl);
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      toast.danger(
        code === "FILE_TOO_LARGE"
          ? messages.playground.referenceTooLarge
          : messages.playground.referenceReadFailed,
      );
    }
  }

  return (
    <Field
      label={label}
      htmlFor={inputId}
      hint={hint ? <p className="text-xs text-zinc-400">{hint}</p> : undefined}
    >
      <div className="space-y-2">
        {thumb ? (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
            <img src={thumb} alt="" className="max-h-28 w-full object-contain" />
          </div>
        ) : null}

        {multiline ? (
          <Textarea
            id={inputId}
            rows={3}
            className="font-mono text-xs"
            placeholder={messages.playground.referenceUrlsPlaceholder}
            value={urlValue}
            onChange={(event) => onUrlChange(event.target.value)}
          />
        ) : (
          <Input
            id={inputId}
            size="sm"
            className="font-mono text-xs"
            placeholder={messages.playground.referenceUrlPlaceholder}
            value={urlValue}
            onChange={(event) => onUrlChange(event.target.value)}
          />
        )}

        {allowFile ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept={PLAYGROUND_CHAT_MEDIA_ACCEPT}
              className="hidden"
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full justify-center border-dashed"
              onClick={() => fileRef.current?.click()}
            >
              <Icon icon={UploadSimple} size={14} />
              {messages.playground.uploadReference}
            </Button>
          </>
        ) : null}
      </div>
    </Field>
  );
}
