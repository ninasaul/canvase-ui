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
