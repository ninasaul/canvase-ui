import {
  catalogs,
  defaultLocale,
  featureCatalogs,
  localeIntl,
  type FeatureMessagesMap,
  type FeatureName,
  type Locale,
  type LocaleCatalog,
} from "@/locales/catalog";
import { formatMessage, type MessageValues } from "@/messages/format";
import { enCanvasPlaygroundMessages } from "@/messages/en-canvas-playground";
import { zhCanvasPlaygroundMessages } from "@/messages/zh-canvas-playground";
import { enCommonRoots } from "@/messages/en-common-roots";
import { zhCommonRoots } from "@/messages/zh-common-roots";

export type {
  Locale,
  LocaleCatalog,
  AuthMessages,
  CanvasMessages,
  CommonMessages,
  FeatureMessagesMap,
  FeatureName,
  HomeMessages,
} from "@/locales/catalog";
export {
  defaultLocale,
  featureNames,
  LOCALE_COOKIE_KEY,
  LOCALE_STORAGE_KEY,
  localeHtmlLang,
  localeIntl,
  locales,
} from "@/locales/catalog";
export { formatMessage } from "@/messages/format";

const canvasPlaygroundByLocale = {
  zh: zhCanvasPlaygroundMessages,
  en: enCanvasPlaygroundMessages,
} as const;

const commonRootsByLocale = {
  zh: zhCommonRoots,
  en: enCommonRoots,
} as const;

export type RuntimeMessages = Omit<LocaleCatalog, "canvas"> & {
  canvas: (typeof zhCanvasPlaygroundMessages)["canvas"];
  playground: (typeof zhCanvasPlaygroundMessages)["playground"];
  loading: string;
  cancel: string;
  close: string;
  save: string;
  copyFailed: string;
  requestFailed: string;
  dateTimePicker: (typeof zhCommonRoots)["dateTimePicker"];
};

export type Messages = RuntimeMessages;

/**
 * Active locale for call-time `messages` reads in client libs.
 * Synced only from the `[locale]` route via LocaleProvider.
 */
let activeLocale: Locale = defaultLocale;

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "zh" || value === "en";
}

/** Sync client locale from the `[locale]` route segment. */
export function setActiveLocale(locale: Locale) {
  activeLocale = locale;
}

export function getActiveLocale(): Locale {
  return activeLocale;
}

/** Pure catalog lookup — prefer this (or useMessages) over the Proxy. */
export function getMessages(locale: Locale = activeLocale): RuntimeMessages {
  const base = catalogs[locale] ?? catalogs[defaultLocale];
  const roots = commonRootsByLocale[locale] ?? commonRootsByLocale[defaultLocale];
  const canvasPlayground =
    canvasPlaygroundByLocale[locale] ?? canvasPlaygroundByLocale[defaultLocale];
  return {
    ...base,
    ...roots,
    ...canvasPlayground,
  } as RuntimeMessages;
}

export function getFeatureMessages<Name extends FeatureName>(
  feature: Name,
  locale: Locale = activeLocale,
): FeatureMessagesMap[Name] {
  const catalog = featureCatalogs[locale] ?? featureCatalogs[defaultLocale];
  return catalog[feature];
}

export function getIntlLocale(locale: Locale = activeLocale): string {
  return localeIntl[locale] ?? localeIntl[defaultLocale];
}

export function t(template: string, values?: MessageValues): string {
  return formatMessage(template, values);
}

/**
 * Call-time catalog for client libs that cannot take a locale param yet.
 * Must be used after LocaleProvider has synced activeLocale from the route.
 * Prefer `useMessages()` in React components and `getMessages(locale)` elsewhere.
 */
export const messages: RuntimeMessages = new Proxy({} as RuntimeMessages, {
  get(_target, property, receiver) {
    const catalog = getMessages(activeLocale);
    const value = Reflect.get(catalog, property, receiver);
    return typeof value === "function" ? value.bind(catalog) : value;
  },
  ownKeys() {
    return Reflect.ownKeys(getMessages(activeLocale));
  },
  getOwnPropertyDescriptor(_target, property) {
    return Reflect.getOwnPropertyDescriptor(getMessages(activeLocale), property);
  },
  has(_target, property) {
    return Reflect.has(getMessages(activeLocale), property);
  },
});
