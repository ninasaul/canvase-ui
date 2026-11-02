import {
  ImageSquare,
  TextT,
  VideoCamera,
  Waveform,
} from "@phosphor-icons/react";

import { messages } from "@/messages";

import type { Icon as IconType } from "@phosphor-icons/react";

type IconComponent = IconType;

/** Phosphor icon for a canvas node type. */
export function nodeTypeIcon(type: string | undefined): IconComponent {
  switch (type) {
    case "image":
      return ImageSquare;
    case "video":
      return VideoCamera;
    case "audio":
      return Waveform;
    default:
      return TextT;
  }
}

/** Localized display name for a canvas node type. */
export function nodeTypeLabel(type: string | undefined): string {
  switch (type) {
    case "image":
      return messages.canvas.imageNode;
    case "video":
      return messages.canvas.videoNode;
    case "audio":
      return messages.canvas.audioNode;
    case "group":
      return messages.canvas.groupSelection;
    default:
      return messages.canvas.textNode;
  }
}

/** Human label for a node run status. */
export function nodeStatusLabel(status: string | undefined): string {
    switch (status) {
      case "queued":
        return messages.canvas.statusQueued;
      case "running":
        return messages.canvas.statusRunning;
      case "succeeded":
        return messages.canvas.statusSucceeded;
      case "failed":
        return messages.canvas.statusFailed;
      case "skipped":
        return messages.canvas.statusSkipped;
      case "cancelled":
        return messages.canvas.statusCancelled;
      case "interrupted":
        return messages.canvas.statusInterrupted;
      default:
        return messages.canvas.statusIdle;
    }
}
