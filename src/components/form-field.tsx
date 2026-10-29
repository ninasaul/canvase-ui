"use client";

import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Field } from "@/components/ui/field";
import {
  FORM_CONTROL_DEFAULT_SIZE,
  selectTriggerClassName,
  type FormControlSize,
} from "@/components/ui/form-control";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { messages } from "@/messages";
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useMemo,
  type HTMLInputTypeAttribute,
  type ReactNode,
} from "react";

const EMPTY_SELECT_KEY = "__empty__";

export type FieldVariant = "primary" | "secondary";

const FieldVariantContext = createContext<FieldVariant>("primary");
const CompactFieldContext = createContext(false);

export function FieldSurface({
  variant = "secondary",
  children,
}: {
  variant?: FieldVariant;
  children: ReactNode;
}) {
  return (
    <FieldVariantContext.Provider value={variant}>
      {children}
    </FieldVariantContext.Provider>
  );
}

/** 筛选条等场景：更小的控件和更轻的 label。 */
export function CompactFields({ children }: { children: ReactNode }) {
  return (
    <CompactFieldContext.Provider value={true}>
      {children}
    </CompactFieldContext.Provider>
  );
}

function useFieldVariant(override?: FieldVariant): FieldVariant {
  const context = useContext(FieldVariantContext);
  return override ?? context;
}

function useCompactField() {
  return useContext(CompactFieldContext);
}

function useFieldSize(): FormControlSize {
  return useCompactField() ? "xs" : FORM_CONTROL_DEFAULT_SIZE;
}

function compactFieldChrome(compact: boolean) {
  if (!compact) {
    return {};
  }
  return {
    className: "!space-y-1",
    labelClassName: "text-[11px] font-medium text-zinc-400",
  };
}

function fieldControlVariant(variant: FieldVariant): "solid" | "soft" {
  return variant === "primary" ? "solid" : "soft";
}

export type SelectOption = {
  value: string;
  label: ReactNode;
};

function parseOptionChildren(children: ReactNode): SelectOption[] {
  const options: SelectOption[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === "option") {
      const props = child.props as { value?: string; children?: ReactNode };
      options.push({
        value: props.value ?? "",
        label: props.children ?? props.value ?? "",
      });
    }
  });
  return options;
}

function formatPlaceholder(template: string, label: string): string {
  return template.replace("{label}", label);
}

function defaultInputPlaceholder(
  type: HTMLInputTypeAttribute,
  label: string,
): string | undefined {
  if (type === "password") {
    return "••••••••";
  }
  if (type === "datetime-local") {
    return formatPlaceholder(messages.placeholderSelect, label);
  }
  return formatPlaceholder(messages.placeholderInput, label);
}

type FieldChrome = {
  label: string;
  description?: string;
  name?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  variant?: FieldVariant;
};

export function FormField({
  label,
  description,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  isRequired,
  isDisabled,
  isReadOnly,
  autoComplete,
  autoFocus,
  min,
  max,
  step,
  maxLength,
  variant,
  leading,
  trailing,
  defaultTime,
}: FieldChrome & {
  type?: HTMLInputTypeAttribute;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isReadOnly?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  maxLength?: number;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Used by datetime-local when the field is empty. `HH:mm`. */
  defaultTime?: string;
  validate?: (value: string) => string | true | null | undefined;
}) {
  const fieldVariant = useFieldVariant(variant);
  const compact = useCompactField();
  const size = useFieldSize();
  const resolvedPlaceholder =
    placeholder ?? defaultInputPlaceholder(type, label);
  const inputVariant = fieldControlVariant(fieldVariant);
  const fieldLabel = (
    <>
      {label}
      {isRequired ? <span className="text-red-500"> *</span> : null}
    </>
  );
  const fieldHint = description ? (
    <p className="text-xs text-zinc-400">{description}</p>
  ) : undefined;
  const chrome = compactFieldChrome(compact);
  const compactControlClass = compact
    ? "focus:shadow-none focus-within:shadow-none"
    : "";

  if (type === "datetime-local") {
    return (
      <Field label={fieldLabel} hint={fieldHint} htmlFor={name} {...chrome}>
        <DateTimePicker
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={resolvedPlaceholder}
          disabled={isDisabled || isReadOnly}
          variant={inputVariant}
          size={size}
          quiet={compact}
          min={typeof min === "string" ? min : undefined}
          max={typeof max === "string" ? max : undefined}
          defaultTime={defaultTime}
          ariaLabel={label}
          required={isRequired}
        />
      </Field>
    );
  }

  return (
    <Field label={fieldLabel} hint={fieldHint} htmlFor={name} {...chrome}>
      <Input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={resolvedPlaceholder}
        disabled={isDisabled}
        readOnly={isReadOnly}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        min={min}
        max={max}
        step={step}
        maxLength={maxLength}
        leading={leading}
        trailing={trailing}
        variant={inputVariant}
        size={size}
        className={compactControlClass}
        wrapperClassName={compactControlClass}
        required={isRequired}
      />
    </Field>
  );
}

export function SelectField({
  label,
  description,
  name,
  value,
  onChange,
  children,
  placeholder,
  isRequired,
  isDisabled,
  variant,
}: FieldChrome & {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  placeholder?: string;
}) {
  const fieldVariant = useFieldVariant(variant);
  const compact = useCompactField();
  const size = useFieldSize();
  const options = useMemo(() => parseOptionChildren(children), [children]);
  const resolvedPlaceholder =
    placeholder ?? formatPlaceholder(messages.placeholderSelect, label);

  return (
    <Field
      label={
        <>
          {label}
          {isRequired ? <span className="text-red-500"> *</span> : null}
        </>
      }
      hint={
        description ? (
          <p className="text-xs text-zinc-400">{description}</p>
        ) : undefined
      }
      {...compactFieldChrome(compact)}
    >
      <Select
        id={name}
        value={value === "" ? EMPTY_SELECT_KEY : value}
        onChange={(next) =>
          onChange(next === EMPTY_SELECT_KEY ? "" : next)
        }
        options={options.map((option) => ({
          value: option.value === "" ? EMPTY_SELECT_KEY : option.value,
          label:
            typeof option.label === "string"
              ? option.label
              : option.value || String(option.label),
        }))}
        placeholder={resolvedPlaceholder}
        disabled={isDisabled}
        ariaLabel={label}
        className="w-full"
        menuWidth="trigger"
        triggerClassName={selectTriggerClassName(
          fieldControlVariant(fieldVariant),
          size,
          compact,
        )}
      />
    </Field>
  );
}

export function TextAreaField({
  label,
  description,
  name,
  value,
  onChange,
  className,
  isRequired,
  isDisabled,
  rows = 4,
  variant,
  placeholder,
}: FieldChrome & {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  rows?: number;
  placeholder?: string;
  validate?: (value: string) => string | true | null | undefined;
}) {
  const fieldVariant = useFieldVariant(variant);
  const size = useFieldSize();
  const resolvedPlaceholder =
    placeholder ?? formatPlaceholder(messages.placeholderInput, label);
  const textareaVariant = fieldControlVariant(fieldVariant);

  return (
    <Field
      label={
        <>
          {label}
          {isRequired ? <span className="text-red-500"> *</span> : null}
        </>
      }
      hint={
        description ? (
          <p className="text-xs text-zinc-400">{description}</p>
        ) : undefined
      }
    >
      <Textarea
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={className}
        rows={rows}
        placeholder={resolvedPlaceholder}
        disabled={isDisabled}
        variant={textareaVariant}
        size={size}
        required={isRequired}
      />
    </Field>
  );
}

export function SwitchField({
  label,
  description,
  name,
  isSelected,
  onChange,
  isDisabled,
}: {
  label: string;
  description?: string;
  name?: string;
  isSelected: boolean;
  onChange: (value: boolean) => void;
  isDisabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
        <Switch
          id={name}
          checked={isSelected}
          disabled={isDisabled}
          onChange={onChange}
        />
      </div>
      {description ? (
        <p className="text-xs text-zinc-400">{description}</p>
      ) : null}
    </div>
  );
}

export function FormFields({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ?? "flex w-full flex-col gap-4"}>{children}</div>
  );
}
