import enAuth from "@/locales/en/auth.json";
import enCanvas from "@/locales/en/canvas.json";
import enCommon from "@/locales/en/common.json";
import enHome from "@/locales/en/home.json";
import zhAuth from "@/locales/zh/auth.json";
import zhCanvas from "@/locales/zh/canvas.json";
import zhCommon from "@/locales/zh/common.json";
import zhHome from "@/locales/zh/home.json";

export const featureNames = ["common", "home", "auth", "canvas"] as const;
export type FeatureName = (typeof featureNames)[number];

export type CommonMessages = typeof zhCommon;
export type HomeMessages = typeof zhHome;
export type AuthMessages = typeof zhAuth;
export type CanvasMessages = typeof zhCanvas;

export type FeatureMessagesMap = {
  common: CommonMessages;
  home: HomeMessages;
  auth: AuthMessages;
  canvas: CanvasMessages;
};

export type LocaleCatalog = CommonMessages & {
  home: HomeMessages;
  auth: AuthMessages;
  canvas: CanvasMessages;
};

export type Locale = "zh" | "en";

export const locales: Locale[] = ["zh", "en"];
export const defaultLocale: Locale = "zh";

export const localeHtmlLang: Record<Locale, string> = {
  zh: "zh-CN",
  en: "en",
};

export const localeIntl: Record<Locale, string> = {
  zh: "zh-CN",
  en: "en-US",
};

export const LOCALE_STORAGE_KEY = "canvase.locale";
export const LOCALE_COOKIE_KEY = "canvase.locale";

const zhCatalog: LocaleCatalog = {
  ...zhCommon,
  home: zhHome,
  auth: zhAuth,
  canvas: zhCanvas,
};

const enCatalog: LocaleCatalog = {
  ...enCommon,
  home: enHome,
  auth: enAuth,
  canvas: enCanvas,
};

export const catalogs: Record<Locale, LocaleCatalog> = {
  zh: zhCatalog,
  en: enCatalog,
};

export const featureCatalogs: Record<
  Locale,
  FeatureMessagesMap
> = {
  zh: {
    common: zhCommon,
    home: zhHome,
    auth: zhAuth,
    canvas: zhCanvas,
  },
  en: {
    common: enCommon,
    home: enHome,
    auth: enAuth,
    canvas: enCanvas,
  },
};
