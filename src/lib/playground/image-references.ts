import { fileToDataUrl, parseReferenceUrls } from "@/lib/playground-media";

export const MAX_IMAGE_REFERENCE_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGE_REFERENCES = 9;

export type PlaygroundImageReference = {
  id: string;
  kind: "file" | "url";
  name: string;
  previewUrl: string;
  file?: File;
  url?: string;
  assetId?: string;
};

function newReferenceId(): string {
  return `ref_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createFileReference(file: File): PlaygroundImageReference {
  if (file.size > MAX_IMAGE_REFERENCE_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }
  return {
    id: newReferenceId(),
    kind: "file",
    name: file.name || "image",
    previewUrl: URL.createObjectURL(file),
    file,
  };
}

export function createUrlReference(
  url: string,
  index = 0,
  assetId?: string,
): PlaygroundImageReference {
  const trimmed = url.trim();
  const label = (() => {
    try {
      const parsed = new URL(trimmed);
      const segment = parsed.pathname.split("/").filter(Boolean).pop();
      return segment || `url-${index + 1}`;
    } catch {
      return `url-${index + 1}`;
    }
  })();
  return {
    id: newReferenceId(),
    kind: "url",
    name: label,
    previewUrl: trimmed,
    url: trimmed,
    ...(assetId ? { assetId } : {}),
  };
}

export function referencesFromDraftString(value: string): PlaygroundImageReference[] {
  return parseReferenceUrls(value)
    .filter((url) => !url.startsWith("data:"))
    .map((url, index) => createUrlReference(url, index));
}

export function referenceUrlsForDraft(
  references: PlaygroundImageReference[],
): string {
  return references
    .filter((item) => item.kind === "url" && item.url)
    .map((item) => item.url!)
    .join("\n");
}

export function revokeReferencePreviews(references: PlaygroundImageReference[]): void {
  for (const item of references) {
    if (item.kind === "file" && item.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }
}

export function splitImageReferences(references: PlaygroundImageReference[]): {
  files: File[];
  urls: string[];
} {
  const files: File[] = [];
  const urls: string[] = [];
  for (const item of references) {
    if (item.kind === "file" && item.file) {
      files.push(item.file);
    } else if (item.kind === "url" && item.url) {
      urls.push(item.url);
    }
  }
  return { files, urls };
}

export async function resolveReferenceUrl(
  reference: PlaygroundImageReference,
): Promise<string> {
  if (reference.kind === "url" && reference.url) {
    return reference.url;
  }
  if (reference.kind === "file" && reference.file) {
    return fileToDataUrl(reference.file);
  }
  throw new Error("INVALID_REFERENCE");
}
