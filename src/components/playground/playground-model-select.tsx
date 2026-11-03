"use client";

import { useMemo } from "react";
import { ModelNameWithLogo } from "@/components/model-name-with-logo";
import { PLAYGROUND_TOOLBAR_SELECT_TRIGGER } from "@/components/playground/playground-styles";
import { Select, type SelectOption } from "@/components/ui/select";
import { useCurrencySymbol } from "@/hooks/use-currency-symbol";
import { inferModelVendor } from "@/lib/infer-model-vendor";
import { modelVendorLabel } from "@/lib/model-vendors";
import { summarizePortalModelPrice } from "@/lib/playground-model-summary";
import { messages } from "@/messages";
import type { PortalPublicModel } from "@/types/admin";

export function modelLogoLeading(model: PortalPublicModel, size = 14) {
  return (
    <ModelNameWithLogo
      name={model.display_name || model.id}
      matchParts={[model.id, model.vendor, model.owned_by]}
      size={size}
      layout="inline"
      nameClassName="sr-only"
      className="pointer-events-none"
    />
  );
}

function modelMenuPrice(
  model: PortalPublicModel,
  symbol: string,
): string | undefined {
  return summarizePortalModelPrice(model, symbol) ?? undefined;
}

function modelVendorGroup(model: PortalPublicModel): string {
  const raw =
    model.vendor?.trim() ||
    inferModelVendor(model.id, model.display_name, model.owned_by) ||
    model.owned_by?.trim() ||
    "";
  return modelVendorLabel(raw) || messages.playground.modelVendorOther;
}

type PlaygroundModelSelectProps = {
  id?: string;
  models: PortalPublicModel[];
  value: string;
  disabled?: boolean;
  menuZIndex?: number;
  className?: string;
  triggerClassName?: string;
  onChange: (modelId: string) => void;
};

export function PlaygroundModelSelect({
  id,
  models,
  value,
  disabled,
  menuZIndex = 50,
  className,
  triggerClassName,
  onChange,
}: PlaygroundModelSelectProps) {
  const symbol = useCurrencySymbol();
  const selected = useMemo(
    () => models.find((item) => item.id === value),
    [models, value],
  );

  const options: SelectOption[] = useMemo(() => {
    const sorted = [...models].sort((left, right) => {
      const leftGroup = modelVendorGroup(left);
      const rightGroup = modelVendorGroup(right);
      const byGroup = leftGroup.localeCompare(rightGroup, undefined, {
        sensitivity: "base",
      });
      if (byGroup !== 0) {
        return byGroup;
      }
      return left.id.localeCompare(right.id, undefined, { sensitivity: "base" });
    });
    return sorted.map((item) => ({
      value: item.id,
      label: item.id,
      group: modelVendorGroup(item),
      description: modelMenuPrice(item, symbol),
      leading: modelLogoLeading(item),
    }));
  }, [models, symbol]);

  return (
    <Select
      id={id}
      value={value}
      options={options}
      placeholder={messages.playground.modelPlaceholder}
      disabled={disabled || models.length === 0}
      size="compact"
      menuWidth="auto"
      menuMinWidth={280}
      menuMaxWidth={360}
      menuZIndex={menuZIndex}
      searchable={models.length > 6}
      searchPlaceholder={messages.playground.modelSearch}
      emptySearchLabel={messages.playground.modelSearchEmpty}
      className={className}
      ariaLabel={messages.playground.model}
      triggerClassName={triggerClassName ?? PLAYGROUND_TOOLBAR_SELECT_TRIGGER}
      leading={selected ? modelLogoLeading(selected) : undefined}
      onChange={onChange}
    />
  );
}
