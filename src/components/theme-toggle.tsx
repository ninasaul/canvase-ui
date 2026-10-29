"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { useClientMounted } from "@/hooks/use-client-mounted";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useTheme } from "@/components/theme-provider";
import { useFeatureMessages } from "@/hooks/use-feature-messages";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const common = useFeatureMessages("common");
  const mounted = useClientMounted();

  const isDark = resolvedTheme === "dark";
  const label = isDark ? common.themeLight : common.themeDark;

  return (
    <Button
      size="icon-sm"
      variant="ghost"
      className={className}
      aria-label={mounted ? label : common.themeToggle}
      title={mounted ? label : undefined}
      disabled={!mounted}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {/* Stable icon until mounted — avoids SSR/client theme mismatch. */}
      <Icon icon={mounted && isDark ? Sun : Moon} size={14} />
    </Button>
  );
}
