import { resolveModelLogoStem } from "@/lib/model-logo";
import { isKnownModelVendor } from "@/lib/model-vendors";

/** Product logo stems that belong to a foundation vendor. */
const LOGO_STEM_TO_VENDOR: Record<string, string> = {
  seedance: "bytedance",
  nanobanana: "Gemini",
};

/** Guess catalog vendor from upstream id / display name for listing forms. */
export function inferModelVendor(
  ...parts: Array<string | null | undefined>
): string {
  const stem = resolveModelLogoStem(...parts);
  if (!stem) {
    return "";
  }
  const mappedVendor = LOGO_STEM_TO_VENDOR[stem];
  if (mappedVendor && isKnownModelVendor(mappedVendor)) {
    return mappedVendor;
  }
  if (isKnownModelVendor(stem)) {
    return stem;
  }
  return "";
}
