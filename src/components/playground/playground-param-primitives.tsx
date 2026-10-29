"use client";

import type { ReactNode } from "react";
import { Field, type FieldProps } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Surface } from "@/components/ui/surface";
import {
  PLAYGROUND_FAMILY_BADGE_CLASS,
  PLAYGROUND_PARAM_GRID_CLASS,
  PLAYGROUND_PARAM_LABEL_CLASS,
  PLAYGROUND_PARAM_SURFACE_CLASS,
} from "@/components/playground/playground-styles";
import { messages } from "@/messages";

export function PlaygroundSettingsShell({
  embedded,
  children,
}: {
  embedded?: boolean;
  children: ReactNode;
}) {
  if (embedded) {
    return <div className="space-y-1">{children}</div>;
  }

  return <Surface className={PLAYGROUND_PARAM_SURFACE_CLASS}>{children}</Surface>;
}

export function PlaygroundParamHeader({
  familyLabel,
}: {
  embedded?: boolean;
  familyLabel: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <p className={PLAYGROUND_PARAM_LABEL_CLASS}>
        {messages.playground.paramsTitle}
      </p>
      <span className={PLAYGROUND_FAMILY_BADGE_CLASS}>{familyLabel}</span>
    </div>
  );
}

export function PlaygroundParamGrid({ children }: { children: ReactNode }) {
  return <div className={PLAYGROUND_PARAM_GRID_CLASS}>{children}</div>;
}

export function PlaygroundParamField({
  labelClassName = PLAYGROUND_PARAM_LABEL_CLASS,
  ...props
}: FieldProps) {
  return <Field labelClassName={labelClassName} {...props} />;
}

/** Label left, slider + value right on one row (aligned ends). */
export function PlaygroundParamSlider({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  disabled,
  formatValue = (next) => String(next),
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
  hint?: ReactNode;
}) {
  const formatted = formatValue(value);

  return (
    <div className="w-full space-y-1">
      <div className="flex w-full items-center justify-between gap-3">
        <label
          htmlFor={id}
          className={`${PLAYGROUND_PARAM_LABEL_CLASS} min-w-0 flex-1`}
        >
          {label}
        </label>
        <div className="flex shrink-0 items-center gap-2.5">
          <span
            className="min-w-[2.75rem] shrink-0 text-right text-xs font-medium tabular-nums text-zinc-700 dark:text-zinc-200"
            title={formatted}
          >
            {formatted}
          </span>
          <Slider
            id={id}
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled || min >= max}
            showValue={false}
            className="w-24 shrink-0 space-y-0 sm:w-28"
            onChange={onChange}
          />
        </div>
      </div>
      {hint ? <div>{hint}</div> : null}
    </div>
  );
}

export function PlaygroundParamSwitch({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Switch
      id={id}
      layout="between"
      checked={checked}
      disabled={disabled}
      label={label}
      onChange={onChange}
    />
  );
}
