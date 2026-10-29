"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarBlank,
  X,
} from "@phosphor-icons/react";

import { DropdownMenu, type DropdownMenuOption } from "@/components/ui/dropdown-menu";
import {
  FORM_CONTROL_DEFAULT_SIZE,
  formControlClassName,
  type FormControlSize,
} from "@/components/ui/form-control";
import { Icon } from "@/components/ui/icon";
import {
  buildCalendarGrid,
  formatDateTimeValue,
  formatDisplayDateTime,
  formatMonthTitle,
  getWeekdayLabels,
  HOUR_OPTIONS,
  MINUTE_OPTIONS,
  parseClockTime,
  parseDateTimeValue,
  pad2,
  toIsoDay,
} from "@/lib/datetime-picker-utils";
import { getIntlLocale, messages } from "@/messages";

const PICKER_GAP = 6;
const PICKER_Z_INDEX = 120;
const PICKER_SELECT_Z_INDEX = 130;
const PICKER_WIDTH = 320;
const VIEWPORT_PADDING = 8;
const WEEK_STARTS_ON: 0 | 1 = 1;

const INLINE_SELECT_CLASS_NAME =
  "ui-press flex h-8 min-w-0 flex-1 cursor-pointer items-center justify-between gap-1 rounded-lg border border-zinc-200 bg-white px-2 text-sm outline-none transition hover:border-zinc-300 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700";

function buildTimeOptions(values: readonly string[]): DropdownMenuOption[] {
  return values.map((value) => ({ value, label: value }));
}

const HOUR_MENU_OPTIONS = buildTimeOptions(HOUR_OPTIONS);
const MINUTE_MENU_OPTIONS = buildTimeOptions(MINUTE_OPTIONS);

export type DateTimePickerVariant = "solid" | "soft";

export type DateTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  variant?: DateTimePickerVariant;
  size?: FormControlSize;
  /** Lighter focus ring, used by compact filter bars. */
  quiet?: boolean;
  min?: string;
  max?: string;
  /** Used when the field is empty and the user first picks a day. `HH:mm`. */
  defaultTime?: string;
  ariaLabel?: string;
  required?: boolean;
};

type PickerPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  opensUpward: boolean;
};

function getPickerPosition(
  triggerRect: DOMRect,
  panelHeight = 380,
): PickerPosition {
  const width = Math.min(PICKER_WIDTH, window.innerWidth - VIEWPORT_PADDING * 2);
  const left = Math.max(
    VIEWPORT_PADDING,
    Math.min(triggerRect.left, window.innerWidth - width - VIEWPORT_PADDING),
  );
  const spaceBelow = window.innerHeight - triggerRect.bottom - PICKER_GAP - VIEWPORT_PADDING;
  const spaceAbove = triggerRect.top - PICKER_GAP - VIEWPORT_PADDING;
  const openUpward = spaceBelow < panelHeight && spaceAbove > spaceBelow;

  if (openUpward) {
    return {
      left,
      width,
      bottom: window.innerHeight - triggerRect.top + PICKER_GAP,
      opensUpward: true,
    };
  }

  return {
    left,
    width,
    top: triggerRect.bottom + PICKER_GAP,
    opensUpward: false,
  };
}

function triggerSurfaceClass(
  variant: DateTimePickerVariant,
  quiet: boolean,
): string {
  if (quiet) {
    return "border border-zinc-200/80 bg-white hover:border-zinc-300 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700";
  }
  return variant === "solid"
    ? "border border-zinc-200 bg-white focus:border-zinc-400 focus:shadow-[0_0_0_3px_rgba(161,161,170,0.18)] dark:border-zinc-800 dark:bg-zinc-950 dark:focus:shadow-[0_0_0_3px_rgba(113,113,122,0.28)]"
    : "border border-zinc-200 bg-zinc-50/80 focus:border-zinc-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(161,161,170,0.18)] dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-600 dark:focus:bg-zinc-900 dark:focus:shadow-[0_0_0_3px_rgba(113,113,122,0.28)]";
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isDayDisabled(date: Date, min: Date | null, max: Date | null) {
  const day = startOfDay(date).getTime();
  if (min && day < startOfDay(min).getTime()) {
    return true;
  }
  if (max && day > startOfDay(max).getTime()) {
    return true;
  }
  return false;
}

function clampDateTime(date: Date, min: Date | null, max: Date | null) {
  let next = date;
  if (min && next.getTime() < min.getTime()) {
    next = min;
  }
  if (max && next.getTime() > max.getTime()) {
    next = max;
  }
  return next;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder,
  className = "",
  disabled = false,
  name,
  id,
  variant = "soft",
  size = FORM_CONTROL_DEFAULT_SIZE,
  quiet = false,
  min,
  max,
  defaultTime = "00:00",
  ariaLabel,
  required = false,
}: DateTimePickerProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PickerPosition | null>(null);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const fallbackClock = parseClockTime(defaultTime) ?? { hour: "00", minute: "00" };
  const [selectedHour, setSelectedHour] = useState(fallbackClock.hour);
  const [selectedMinute, setSelectedMinute] = useState(fallbackClock.minute);

  const parsedValue = parseDateTimeValue(value);
  const minDate = min ? parseDateTimeValue(min) : null;
  const maxDate = max ? parseDateTimeValue(max) : null;
  const todayIsoDay = toIsoDay(new Date());
  const weekdayLabels = getWeekdayLabels(getIntlLocale(), WEEK_STARTS_ON);
  const calendarCells = buildCalendarGrid(viewYear, viewMonth, WEEK_STARTS_ON);
  const selectedIsoDay = parsedValue ? toIsoDay(parsedValue) : null;
  const displayValue = formatDisplayDateTime(value, getIntlLocale());
  const copy = messages.dateTimePicker;

  const updatePanelPosition = useCallback(() => {
    if (!triggerRef.current) {
      return;
    }
    setPanelPosition(
      getPickerPosition(
        triggerRef.current.getBoundingClientRect(),
        panelRef.current?.offsetHeight,
      ),
    );
  }, []);

  const openPicker = () => {
    if (disabled || !triggerRef.current) {
      return;
    }
    const base = parsedValue ?? new Date();
    const clock = parsedValue
      ? { hour: pad2(parsedValue.getHours()), minute: pad2(parsedValue.getMinutes()) }
      : (parseClockTime(defaultTime) ?? fallbackClock);
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setSelectedHour(clock.hour);
    setSelectedMinute(clock.minute);
    setPanelPosition(getPickerPosition(triggerRef.current.getBoundingClientRect()));
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    updatePanelPosition();
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (target instanceof Element && target.closest("[data-dropdown-menu-portal]")) {
        return;
      }
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open, updatePanelPosition]);

  const applyDateTime = (date: Date, hour: string, minute: string) => {
    const next = new Date(date);
    next.setHours(Number(hour), Number(minute), 0, 0);
    onChange(formatDateTimeValue(clampDateTime(next, minDate, maxDate)));
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const selectDay = (date: Date) => {
    if (isDayDisabled(date, minDate, maxDate)) {
      return;
    }
    applyDateTime(date, selectedHour, selectedMinute);
  };

  const updateTime = (hour: string, minute: string) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    const today = new Date();
    const daysInViewMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const day = parsedValue
      ? parsedValue.getDate()
      : Math.min(today.getDate(), daysInViewMonth);
    const baseDate = parsedValue ?? new Date(viewYear, viewMonth, day);
    applyDateTime(baseDate, hour, minute);
  };

  const panelContent =
    open && panelPosition ? (
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-label={copy.select}
        className={`rounded-2xl border border-zinc-100 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 ${
          panelPosition.opensUpward ? "ui-menu-enter-top" : "ui-menu-enter-bottom"
        }`}
        style={{
          position: "fixed",
          top: panelPosition.top,
          bottom: panelPosition.bottom,
          left: panelPosition.left,
          width: panelPosition.width,
          zIndex: PICKER_Z_INDEX,
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="ui-press rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
            aria-label={copy.prevMonth}
          >
            <Icon icon={ArrowLeft} size={16} />
          </button>
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {formatMonthTitle(viewYear, viewMonth, getIntlLocale())}
          </div>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="ui-press rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
            aria-label={copy.nextMonth}
          >
            <Icon icon={ArrowRight} size={16} />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1">
          {weekdayLabels.map((label) => (
            <div key={label} className="py-1 text-center text-[11px] text-zinc-400">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((cell) => {
            const selected = selectedIsoDay === cell.isoDay;
            const today = todayIsoDay === cell.isoDay;
            const dayDisabled = isDayDisabled(cell.date, minDate, maxDate);
            return (
              <button
                key={cell.isoDay}
                type="button"
                disabled={dayDisabled}
                onClick={() => selectDay(cell.date)}
                className={`ui-press h-8 rounded-lg text-xs transition ${
                  selected
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : dayDisabled
                      ? "cursor-not-allowed text-zinc-300 dark:text-zinc-700"
                      : cell.inCurrentMonth
                        ? "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900"
                        : "text-zinc-300 hover:bg-zinc-50 dark:text-zinc-600 dark:hover:bg-zinc-900/60"
                } ${today && !selected ? "ring-1 ring-zinc-300 dark:ring-zinc-700" : ""}`}
              >
                {cell.date.getDate()}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-900">
          <label className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-zinc-500">
            <span>{copy.hour}</span>
            <DropdownMenu
              value={selectedHour}
              onChange={(hour) => updateTime(hour, selectedMinute)}
              options={HOUR_MENU_OPTIONS}
              ariaLabel={copy.hour}
              menuZIndex={PICKER_SELECT_Z_INDEX}
              menuWidth="trigger"
              triggerClassName={INLINE_SELECT_CLASS_NAME}
              className="min-w-0 flex-1"
            />
          </label>
          <span className="text-zinc-300">:</span>
          <label className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-zinc-500">
            <span>{copy.minute}</span>
            <DropdownMenu
              value={selectedMinute}
              onChange={(minute) => updateTime(selectedHour, minute)}
              options={MINUTE_MENU_OPTIONS}
              ariaLabel={copy.minute}
              menuZIndex={PICKER_SELECT_Z_INDEX}
              menuWidth="trigger"
              triggerClassName={INLINE_SELECT_CLASS_NAME}
              className="min-w-0 flex-1"
            />
          </label>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="ui-press inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            <Icon icon={X} size={12} />
            {copy.clear}
          </button>
        </div>
      </div>
    ) : null;

  return (
    <div className={`relative ${className}`.trim()}>
      {name ? (
        <input type="hidden" name={name} value={value} required={required} />
      ) : null}
      <button
        ref={triggerRef}
        id={fieldId}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={ariaLabel ?? copy.select}
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={`ui-press flex w-full cursor-pointer items-center gap-2 ${formControlClassName(size)} text-left text-zinc-900 outline-none transition-[color,background-color,border-color,box-shadow] duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-100 ${triggerSurfaceClass(variant, quiet)}`}
      >
        <Icon icon={CalendarBlank} size={quiet ? 14 : 16} className="shrink-0 text-zinc-400" />
        <span
          className={`min-w-0 truncate ${
            displayValue ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-600"
          }`}
        >
          {displayValue || placeholder || copy.select}
        </span>
      </button>

      {typeof document !== "undefined" && panelContent
        ? createPortal(panelContent, document.body)
        : null}
    </div>
  );
}
