"use client";

import type { ReactNode } from "react";
import { ImageSquare, Sparkle, SquaresFour } from "@phosphor-icons/react";

import { BrandLogo } from "@/components/brand-logo";

import { LocaleToggle } from "@/components/locale-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Icon } from "@/components/ui/icon";
import { useFeatureMessages } from "@/hooks/use-feature-messages";

/**
 * Two-column auth layout: brand story on the left (desktop), form on the right.
 * The toggles let people pick a language before they can sign in.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const auth = useFeatureMessages("auth");
  const common = useFeatureMessages("common");
  const appName = common.appName;

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_15%_-10%,rgba(56,189,248,0.12),transparent),radial-gradient(50rem_36rem_at_100%_0%,rgba(168,85,247,0.10),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,rgba(120,120,130,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(120,120,130,0.10)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(70rem_50rem_at_50%_0%,black,transparent)]"
      />

      <div className="absolute right-4 top-4 z-10 flex items-center gap-1">
        <LocaleToggle />
        <ThemeToggle />
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.05fr_minmax(0,26rem)] lg:gap-16">
        <section className="hidden flex-col gap-8 lg:flex">
          <div className="flex items-center gap-3">
            <BrandLogo size={40} alt={appName} priority />
            <span className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              {appName}
            </span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight">
              {auth.brandHeadline}
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {auth.brandTagline}
            </p>
          </div>

          <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
            {[
              { icon: SquaresFour, text: auth.brandPointGraph },
              { icon: ImageSquare, text: auth.brandPointMedia },
              { icon: Sparkle, text: auth.brandPointAgent },
            ].map((item) => (
              <li key={item.text} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-zinc-500 ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800">
                  <Icon icon={item.icon} size={13} />
                </span>
                <span className="leading-relaxed">{item.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="w-full">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <BrandLogo size={32} alt={appName} priority />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">{appName}</p>
              <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                {auth.brandShort}
              </p>
            </div>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
