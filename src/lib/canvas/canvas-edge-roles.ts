import type {
  CanvasEdgeRole,
  CanvasNodeType,
} from "@/lib/tu-shared-browser";

/** Roles that make sense for a connection, based on source and target types. */
export function edgeRoleOptions(
  sourceType: CanvasNodeType,
  targetType: CanvasNodeType,
): CanvasEdgeRole[] {
  if (targetType === "image") {
    if (sourceType === "text") {
      return ["prompt", "context"];
    }
    if (sourceType === "image") {
      return ["reference_image"];
    }
    return [];
  }

  if (targetType === "video") {
    if (sourceType === "text") {
      return ["prompt", "context"];
    }
    if (sourceType === "image") {
      return ["reference_image", "first_frame", "last_frame"];
    }
    if (sourceType === "video") {
      return ["reference_video"];
    }
    if (sourceType === "audio") {
      return ["reference_audio"];
    }
    return [];
  }

  if (targetType === "text" && sourceType === "text") {
    return ["context"];
  }

  if (targetType === "audio") {
    if (sourceType === "text") {
      return ["prompt", "context"];
    }
    if (sourceType === "audio") {
      return ["reference_audio"];
    }
    return [];
  }

  return [];
}

export function defaultEdgeRole(
  sourceType: CanvasNodeType,
  targetType: CanvasNodeType,
): CanvasEdgeRole | null {
  const options = edgeRoleOptions(sourceType, targetType);
  return options[0] ?? null;
}
