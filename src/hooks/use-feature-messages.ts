"use client";

import { useMemo } from "react";
import { useLocale } from "@/components/locale-provider";
import {
  getFeatureMessages,
  getMessages,
  type FeatureName,
  type RuntimeMessages,
} from "@/messages";

/** Full merged catalog for the active locale (includes ported canvas/playground). */
export function useMessages(): RuntimeMessages {
  const { locale } = useLocale();
  return useMemo(() => getMessages(locale), [locale]);
}

/** Single feature JSON for the active locale, e.g. `useFeatureMessages("auth")`. */
export function useFeatureMessages<Name extends FeatureName>(feature: Name) {
  const { locale } = useLocale();
  return useMemo(() => getFeatureMessages(feature, locale), [feature, locale]);
}
