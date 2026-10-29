"use client";

import { FadersHorizontal, Stack } from "@phosphor-icons/react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import type { VideoReferenceMode } from "@/lib/playground/media-references";
import { messages } from "@/messages";

type PlaygroundReferenceModeSelectProps = {
  value: VideoReferenceMode;
  disabled?: boolean;
  onChange: (mode: VideoReferenceMode) => void;
};

export function PlaygroundReferenceModeSelect({
  value,
  disabled,
  onChange,
}: PlaygroundReferenceModeSelectProps) {
  const selectedLabel =
    value === "omni"
      ? messages.playground.referenceModeOmni
      : messages.playground.referenceModeFrame;

  return (
    <DropdownMenu
      value={value}
      disabled={disabled}
      size="pill"
      tone="default"
      menuMinWidth={168}
      ariaLabel={messages.playground.referenceMode}
      options={[
        {
          value: "frame",
          label: messages.playground.referenceModeFrame,
          description: messages.playground.referenceModeFrameHint,
          leading: <Icon icon={FadersHorizontal} size={14} />,
        },
        {
          value: "omni",
          label: messages.playground.referenceModeOmni,
          description: messages.playground.referenceModeOmniHint,
          leading: <Icon icon={Stack} size={14} />,
        },
      ]}
      triggerContent={
        <>
          <Icon icon={Stack} size={14} className="shrink-0 text-zinc-500" />
          <span className="max-w-24 truncate">{selectedLabel}</span>
        </>
      }
      onChange={(next) => onChange(next === "omni" ? "omni" : "frame")}
    />
  );
}
