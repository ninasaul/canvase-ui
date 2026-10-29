"use client";

import { useRef, useState } from "react";
import { Check, Translate } from "@phosphor-icons/react";
import { useClientMounted } from "@/hooks/use-client-mounted";
import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Popover } from "@/components/ui/popover";
import { useFeatureMessages } from "@/hooks/use-feature-messages";
import type { Locale } from "@/messages";

const LOCALE_OPTIONS: Array<{ value: Locale; labelKey: "localeZh" | "localeEn" }> =
  [
    { value: "zh", labelKey: "localeZh" },
    { value: "en", labelKey: "localeEn" },
  ];

export function LocaleToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const common = useFeatureMessages("common");
  const mounted = useClientMounted();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        ref={buttonRef}
        size="icon-sm"
        variant="ghost"
        className={className}
        aria-label={common.localeToggle}
        title={mounted ? common.localeToggle : undefined}
        aria-expanded={open}
        disabled={!mounted}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon icon={Translate} size={14} />
      </Button>
      <Popover
        open={open}
        onOpenChange={setOpen}
        anchorRef={buttonRef}
        placement="bottom"
        role="menu"
        ariaLabel={common.localeToggle}
        minWidth={140}
        className="p-1"
      >
        <div className="space-y-0.5">
          {LOCALE_OPTIONS.map((option) => {
            const active = locale === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onClick={() => {
                  setLocale(option.value);
                  setOpen(false);
                }}
              >
                <span className="min-w-0 flex-1">{common[option.labelKey]}</span>
                {active ? (
                  <Icon icon={Check} size={12} className="text-sky-500" />
                ) : (
                  <span className="h-3 w-3" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </Popover>
    </>
  );
}
