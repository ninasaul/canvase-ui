import "server-only";

import { notFound } from "next/navigation";
import {
  getMessages,
  isLocale,
  type Locale,
  type RuntimeMessages,
} from "@/messages";

export function hasLocale(value: string): value is Locale {
  return isLocale(value);
}

/** Server-only dictionary loader for the active locale. */
export async function getDictionary(locale: string): Promise<RuntimeMessages> {
  if (!hasLocale(locale)) {
    notFound();
  }
  return getMessages(locale);
}
