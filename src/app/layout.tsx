import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import {
  defaultLocale,
  getFeatureMessages,
  isLocale,
  LOCALE_COOKIE_KEY,
  localeHtmlLang,
} from "@/messages";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE_KEY)?.value;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const common = getFeatureMessages("common", locale);
  return {
    title: common.appName,
    description: common.appTagline,
    icons: {
      icon: [{ url: "/veme.svg", type: "image/svg+xml" }],
      apple: [{ url: "/veme.svg", type: "image/svg+xml" }],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE_KEY)?.value;
  const locale = isLocale(raw) ? raw : defaultLocale;

  return (
    <html lang={localeHtmlLang[locale]} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
