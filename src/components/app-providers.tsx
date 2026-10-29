"use client";

import type { ReactNode } from "react";
import { CurrencyProvider } from "@/components/currency-provider";
import { LocaleProvider } from "@/components/locale-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toast";
import type { Locale } from "@/messages";

type AppProvidersProps = {
  children: ReactNode;
  locale: Locale;
};

export function AppProviders({ children, locale }: AppProvidersProps) {
  return (
    <ThemeProvider>
      <LocaleProvider locale={locale}>
        <CurrencyProvider>
          {children}
          <Toaster />
        </CurrencyProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
