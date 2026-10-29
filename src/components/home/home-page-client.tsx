"use client";

import { BrandLogo } from "@/components/brand-logo";
import { LocaleToggle } from "@/components/locale-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonClassName } from "@/components/ui/button";
import { useFeatureMessages } from "@/hooks/use-feature-messages";
import { LocaleLink } from "@/lib/locale-navigation";

type HomePageClientProps = {
  isSignedIn: boolean;
};

export function HomePageClient({ isSignedIn }: HomePageClientProps) {
  const common = useFeatureMessages("common");
  const home = useFeatureMessages("home");

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#e8eef7,_#f8fafc_55%,_#f4f4f5)] dark:bg-[radial-gradient(circle_at_top,_#18181b,_#09090b_55%,_#000)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16">
        <div className="absolute right-6 top-6 flex items-center gap-1">
          <LocaleToggle />
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-3">
          <BrandLogo size={40} alt={common.appName} priority />
          <p className="text-sm font-medium tracking-[0.2em] text-zinc-500 uppercase">
            {common.appName}
          </p>
        </div>
        <h1 className="mt-4 max-w-2xl text-5xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {common.appTagline}
        </h1>
        <p className="mt-4 max-w-xl text-base text-zinc-600 dark:text-zinc-400">
          {home.description}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <LocaleLink
            href={isSignedIn ? "/canvas" : "/register"}
            className={buttonClassName()}
          >
            {home.ctaStart}
          </LocaleLink>
          {!isSignedIn ? (
            <LocaleLink
              href="/login"
              className={buttonClassName({ variant: "secondary" })}
            >
              {home.ctaSignIn}
            </LocaleLink>
          ) : null}
        </div>
      </div>
    </main>
  );
}
