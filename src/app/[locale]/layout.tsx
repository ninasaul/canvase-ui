import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppProviders } from "@/components/app-providers";
import { getDictionary, hasLocale } from "@/i18n/get-dictionary";
import { locales, type Locale } from "@/messages";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!hasLocale(raw)) {
    return {};
  }
  const dictionary = await getDictionary(raw);
  return {
    title: dictionary.appName,
    description: dictionary.appTagline,
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale: raw } = await params;
  if (!hasLocale(raw)) {
    notFound();
  }
  const locale = raw as Locale;

  return <AppProviders locale={locale}>{children}</AppProviders>;
}
