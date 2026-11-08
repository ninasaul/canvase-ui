"use client";

import { Fragment } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { LocaleToggle } from "@/components/locale-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonClassName } from "@/components/ui/button";
import { DiagonalMarqueeCarousel } from "@/components/ui/diagonal-marquee-carousel";
import { TypewriterText } from "@/components/ui/typewriter-text";
import { useFeatureMessages } from "@/hooks/use-feature-messages";
import { LocaleLink } from "@/lib/locale-navigation";

type HomePageClientProps = {
  isSignedIn: boolean;
};

export function HomePageClient({ isSignedIn }: HomePageClientProps) {
  const common = useFeatureMessages("common");
  const home = useFeatureMessages("home");

  const highlights = [
    home.highlights.canvas,
    home.highlights.gateway,
    home.highlights.storage,
  ];

  return (
    <main className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-background text-zinc-900 dark:text-zinc-50">
      {/* The media wall is atmosphere, never content: it sits behind an opaque
          scrim so the hero copy keeps AA contrast over every thumbnail. */}
      <div
        aria-hidden
        className="ui-fade-in pointer-events-none absolute inset-0 -z-10"
      >
        <DiagonalMarqueeCarousel
          decorative
          rows={5}
          angle={-20}
          baseSpeed={180}
          className="h-full"
          fadeClassName="from-background"
        />
        <div className="absolute inset-0 bg-white/32 dark:bg-zinc-950/32" />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.82)_30%,rgba(255,255,255,0.45)_57%,rgba(255,255,255,0.02)_100%)] dark:bg-[linear-gradient(100deg,rgba(10,10,10,0.82)_0%,rgba(10,10,10,0.72)_30%,rgba(10,10,10,0.42)_57%,rgba(10,10,10,0.05)_100%)]" />
      </div>

      <header className="relative z-20 flex items-center justify-between gap-4 px-6 pt-6 sm:px-10 sm:pt-8">
        <div className="ui-rise flex items-center gap-2.5">
          <BrandLogo size={28} alt="" priority />
          <span
            aria-hidden
            className="h-4 w-px bg-zinc-300 dark:bg-zinc-700"
          />
          <span className="text-[11px] font-medium tracking-[0.28em] text-zinc-500 uppercase dark:text-zinc-400">
            {common.appName}
          </span>
        </div>
        <div
          className="ui-rise flex items-center gap-0.5 rounded-full border border-zinc-200/80 bg-white/70 p-0.5 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/60"
          style={{ animationDelay: "120ms" }}
        >
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-16 sm:px-10 sm:py-20">
        <div className="max-w-2xl">
          <p
            className="ui-rise text-[11px] font-medium tracking-[0.3em] text-zinc-500 uppercase dark:text-zinc-400"
            style={{ animationDelay: "80ms" }}
          >
            {home.kicker}
          </p>
          <h1
            aria-label={common.appTagline}
            className="ui-rise mt-6 text-balance text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.035em] text-zinc-950 sm:text-6xl lg:text-7xl dark:text-white"
            style={{ animationDelay: "160ms" }}
          >
            <TypewriterText text={common.appTagline} />
          </h1>
          <p
            className="ui-rise mt-6 max-w-lg text-[15px] leading-7 text-zinc-600 dark:text-zinc-300"
            style={{ animationDelay: "240ms" }}
          >
            {home.description}
          </p>
          <div
            className="ui-rise mt-9 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "320ms" }}
          >
            <LocaleLink
              href={isSignedIn ? "/canvas" : "/register"}
              className={buttonClassName({ size: "md", className: "px-5" })}
            >
              {home.ctaStart}
            </LocaleLink>
            {!isSignedIn ? (
              <LocaleLink
                href="/login"
                className={buttonClassName({
                  variant: "secondary",
                  size: "md",
                  className:
                    "border-zinc-300/80 bg-white/60 px-5 backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-900/50",
                })}
              >
                {home.ctaSignIn}
              </LocaleLink>
            ) : null}
          </div>
          <div
            className="ui-rise mt-12 flex flex-col gap-2 text-[11px] font-medium tracking-[0.18em] text-zinc-500 uppercase sm:mt-14 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2 dark:text-zinc-400"
            style={{ animationDelay: "400ms" }}
          >
            {highlights.map((label, index) => (
              <Fragment key={label}>
                {index > 0 ? (
                  <span
                    aria-hidden
                    className="hidden h-3 w-px bg-zinc-300 sm:block dark:bg-zinc-700"
                  />
                ) : null}
                <span>{label}</span>
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
