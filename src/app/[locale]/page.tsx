import { HomePageClient } from "@/components/home/home-page-client";
import { getDictionary, hasLocale } from "@/i18n/get-dictionary";
import { getSession } from "@/lib/session";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) {
    return {};
  }
  const dictionary = await getDictionary(locale);
  return {
    title: dictionary.appName,
    description: dictionary.appTagline,
  };
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  if (!hasLocale(locale)) {
    notFound();
  }
  const session = await getSession();
  return <HomePageClient isSignedIn={Boolean(session?.user)} />;
}
