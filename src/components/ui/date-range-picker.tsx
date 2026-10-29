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

import { Button } from "@/components/ui/button";
import { DropdownMenu, type DropdownMenuOption } from "@/components/ui/dropdown-menu";
import {
  FORM_CONTROL_DEFAULT_SIZE,
  formControlClassName,
  type FormControlSize,
} from "@/components/ui/form-control";
import { Icon } from "@/components/ui/icon";
import {
  applyClockToDay,
  buildCalendarGrid,
  formatDateTimeValue,
  formatDisplayDateRange,
  formatDisplayDateRangeCompact,
  formatMonthTitle,
  getWeekdayLabels,
  HOUR_OPTIONS,
  isDayInLocalRange,
  isSameLocalDay,
  localDayTime,
  MINUTE_OPTIONS,
  parseClockTime,
  parseDateTimeValue,
  pad2,
  startOfLocalDay,
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

export type DateRangePickerVariant = "solid" | "soft";

export type DateRangeQuickPreset = {
  id: string;
  label: string;
  from: string;
  to: string;
};

export type DateRangePickerProps = {
  from: string;
  to: string;
  onApply: (range: { from: string; to: string }) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  variant?: DateRangePickerVariant;
  size?: FormControlSize;
  quiet?: boolean;
  /** Toolbar style — matches SegmentedTabs height, no field chrome. */
  inline?: boolean;
  /** Highlight trigger like a selected tab. */
  active?: boolean;
  compactDisplay?: boolean;
  autoApplyOnComplete?: boolean;
  quickPresets?: DateRangeQuickPreset[];
  /** Used when opening the panel while `from` / `to` are empty. */
  initialRange?: { from: string; to: string };
  min?: string;
  max?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
  ariaLabel?: string;
};

type PickerPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  opensUpward: boolean;
};

type DraftRange = {
  startDay: Date | null;
  endDay: Date | null;
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
};

function getPickerPosition(
  triggerRect: DOMRect,
  panelHeight = 460,
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
  variant: DateRangePickerVariant,
  quiet: boolean,
): string {
  if (quiet) {
    return "border border-zinc-200/80 bg-white hover:border-zinc-300 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700";
  }
  return variant === "solid"
    ? "border border-zinc-200 bg-white focus:border-zinc-400 focus:shadow-[0_0_0_3px_rgba(161,161,170,0.18)] dark:border-zinc-800 dark:bg-zinc-950 dark:focus:shadow-[0_0_0_3px_rgba(113,113,122,0.28)]"
    : "border border-zinc-200 bg-zinc-50/80 focus:border-zinc-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(161,161,170,0.18)] dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-600 dark:focus:bg-zinc-900 dark:focus:shadow-[0_0_0_3px_rgba(113,113,122,0.28)]";
}

function isDayDisabled(date: Date, min: Date | null, max: Date | null) {
  const day = localDayTime(date);
  if (min && day < localDayTime(min)) {
    return true;
  }
  if (max && day > localDayTime(max)) {
    return true;
  }
  return false;
}

function clockFromDate(date: Date | null, fallback: { hour: string; minute: string }) {
  if (!date) {
    return fallback;
  }
  return { hour: pad2(date.getHours()), minute: pad2(date.getMinutes()) };
}

function draftFromValue(
  from: string,
  to: string,
  defaultStartTime: string,
  defaultEndTime: string,
): DraftRange {
  const parsedFrom = parseDateTimeValue(from);
  const parsedTo = parseDateTimeValue(to);
  const startFallback = parseClockTime(defaultStartTime) ?? { hour: "00", minute: "00" };
  const endFallback = parseClockTime(defaultEndTime) ?? { hour: "23", minute: "59" };
  const startClock = clockFromDate(parsedFrom, startFallback);
  const endClock = clockFromDate(parsedTo, endFallback);
  return {
    startDay: parsedFrom ? startOfLocalDay(parsedFrom) : null,
    endDay: parsedTo ? startOfLocalDay(parsedTo) : null,
    startHour: startClock.hour,
    startMinute: startClock.minute,
    endHour: endClock.hour,
    endMinute: endClock.minute,
  };
}

function buildRangeFromDraft(draft: DraftRange): { from: string; to: string } | null {
  if (!draft.startDay || !draft.endDay) {
    return null;
  }
  let startDay = draft.startDay;
  let endDay = draft.endDay;
  if (localDayTime(endDay) < localDayTime(startDay)) {
    [startDay, endDay] = [endDay, startDay];
  }
  const fromDate = applyClockToDay(startDay, draft.startHour, draft.startMinute);
  const toDate = applyClockToDay(endDay, draft.endHour, draft.endMinute);
  if (toDate.getTime() <= fromDate.getTime()) {
    return null;
  }
  return {
    from: formatDateTimeValue(fromDate),
    to: formatDateTimeValue(toDate),
  };
}

function previewEndDay(
  draft: DraftRange,
  hoverDay: Date | null,
): Date | null {
  if (draft.endDay) {
    return draft.endDay;
  }
  if (draft.startDay && hoverDay) {
    return hoverDay;
  }
  return null;
}

export function DateRangePicker({
  from,
  to,
  onApply,
  placeholder,
  className = "",
  disabled = false,
  variant = "soft",
  size = FORM_CONTROL_DEFAULT_SIZE,
  quiet = false,
  inline = false,
  active = false,
  compactDisplay = false,
  autoApplyOnComplete = false,
  quickPresets,
  initialRange,
  min,
  max,
  defaultStartTime = "00:00",
  defaultEndTime = "23:59",
  ariaLabel,
}: DateRangePickerProps) {
  const generatedId = useId();
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PickerPosition | null>(null);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [draft, setDraft] = useState<DraftRange>(() =>
    draftFromValue(from, to, defaultStartTime, defaultEndTime),
  );
  const [hoverDay, setHoverDay] = useState<Date | null>(null);

  const minDate = min ? parseDateTimeValue(min) : null;
  const maxDate = max ? parseDateTimeValue(max) : null;
  const todayIsoDay = toIsoDay(new Date());
  const weekdayLabels = getWeekdayLabels(getIntlLocale(), WEEK_STARTS_ON);
  const calendarCells = buildCalendarGrid(viewYear, viewMonth, WEEK_STARTS_ON);
  const displayValue = compactDisplay
    ? formatDisplayDateRangeCompact(from, to, getIntlLocale())
    : formatDisplayDateRange(from, to, getIntlLocale());
  const copy = messages.dateTimePicker;
  const previewEnd = previewEndDay(draft, hoverDay);
  const rangeFromDay =
    draft.startDay && previewEnd
      ? localDayTime(draft.startDay) <= localDayTime(previewEnd)
        ? draft.startDay
        : previewEnd
      : draft.startDay;
  const rangeToDay =
    draft.startDay && previewEnd
      ? localDayTime(draft.startDay) <= localDayTime(previewEnd)
        ? previewEnd
        : draft.startDay
      : null;
  const draftRange = buildRangeFromDraft(draft);

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
    const seedFrom = from || initialRange?.from || "";
    const seedTo = to || initialRange?.to || "";
    const nextDraft = draftFromValue(
      seedFrom,
      seedTo,
      defaultStartTime,
      defaultEndTime,
    );
    setDraft(nextDraft);
    setHoverDay(null);
    const base =
      parseDateTimeValue(seedFrom) ??
      parseDateTimeValue(seedTo) ??
      new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
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

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const selectDay = (date: Date) => {
    if (isDayDisabled(date, minDate, maxDate)) {
      return;
    }
    const day = startOfLocalDay(date);
    setDraft((current) => {
      if (!current.startDay || (current.startDay && current.endDay)) {
        return {
          ...current,
          startDay: day,
          endDay: null,
        };
      }
      const next = {
        ...current,
        endDay: day,
      };
      if (autoApplyOnComplete) {
        const built = buildRangeFromDraft(next);
        if (built) {
          window.setTimeout(() => {
            onApply(built);
            setOpen(false);
          }, 0);
        }
      }
      return next;
    });
    setHoverDay(null);
  };

  const applyQuickPreset = (preset: DateRangeQuickPreset) => {
    onApply({ from: preset.from, to: preset.to });
    setOpen(false);
  };

  const applyRange = () => {
    const next = buildRangeFromDraft(draft);
    if (!next) {
      return;
    }
    onApply(next);
    setOpen(false);
  };

  const clearRange = () => {
    const startFallback = parseClockTime(defaultStartTime) ?? { hour: "00", minute: "00" };
    const endFallback = parseClockTime(defaultEndTime) ?? { hour: "23", minute: "59" };
    setDraft({
      startDay: null,
      endDay: null,
      startHour: startFallback.hour,
      startMinute: startFallback.minute,
      endHour: endFallback.hour,
      endMinute: endFallback.minute,
    });
    setHoverDay(null);
  };

  const panelContent =
    open && panelPosition ? (
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-label={copy.selectRange}
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
        {quickPresets && quickPresets.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-1">
            {quickPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyQuickPreset(preset)}
                className="ui-press rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              >
                {preset.label}
              </button>
            ))}
          </div>
        ) : null}

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
            const inCommittedRange = isDayInLocalRange(
              cell.date,
              draft.startDay,
              draft.endDay,
            );
            const inPreviewRange =
              !draft.endDay &&
              rangeFromDay &&
              rangeToDay &&
              isDayInLocalRange(cell.date, rangeFromDay, rangeToDay);
            const inRange = inCommittedRange || inPreviewRange;
            const isStart =
              (draft.startDay && isSameLocalDay(cell.date, draft.startDay)) ||
              (rangeFromDay && isSameLocalDay(cell.date, rangeFromDay));
            const isEnd =
              (draft.endDay && isSameLocalDay(cell.date, draft.endDay)) ||
              (previewEnd && !draft.endDay && isSameLocalDay(cell.date, previewEnd));
            const isEndpoint = isStart || isEnd;
            const today = todayIsoDay === cell.isoDay;
            const dayDisabled = isDayDisabled(cell.date, minDate, maxDate);

            return (
              <button
                key={cell.isoDay}
                type="button"
                disabled={dayDisabled}
                onClick={() => selectDay(cell.date)}
                onMouseEnter={() => {
                  if (draft.startDay && !draft.endDay) {
                    setHoverDay(startOfLocalDay(cell.date));
                  }
                }}
                onMouseLeave={() => setHoverDay(null)}
                className={`ui-press h-8 rounded-lg text-xs transition ${
                  isEndpoint
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : inRange
                      ? "bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                      : dayDisabled
                        ? "cursor-not-allowed text-zinc-300 dark:text-zinc-700"
                        : cell.inCurrentMonth
                          ? "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900"
                          : "text-zinc-300 hover:bg-zinc-50 dark:text-zinc-600 dark:hover:bg-zinc-900/60"
                } ${today && !isEndpoint ? "ring-1 ring-zinc-300 dark:ring-zinc-700" : ""}`}
              >
                {cell.date.getDate()}
              </button>
            );
          })}
        </div>

        <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-900">
          <div className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-xs text-zinc-500">{copy.start}</span>
            <label className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-zinc-500">
              <span>{copy.hour}</span>
              <DropdownMenu
                value={draft.startHour}
                onChange={(hour) =>
                  setDraft((current) => ({ ...current, startHour: hour }))
                }
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
                value={draft.startMinute}
                onChange={(minute) =>
                  setDraft((current) => ({ ...current, startMinute: minute }))
                }
                options={MINUTE_MENU_OPTIONS}
                ariaLabel={copy.minute}
                menuZIndex={PICKER_SELECT_Z_INDEX}
                menuWidth="trigger"
                triggerClassName={INLINE_SELECT_CLASS_NAME}
                className="min-w-0 flex-1"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-xs text-zinc-500">{copy.end}</span>
            <label className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-zinc-500">
              <span>{copy.hour}</span>
              <DropdownMenu
                value={draft.endHour}
                onChange={(hour) =>
                  setDraft((current) => ({ ...current, endHour: hour }))
                }
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
                value={draft.endMinute}
                onChange={(minute) =>
                  setDraft((current) => ({ ...current, endMinute: minute }))
                }
                options={MINUTE_MENU_OPTIONS}
                ariaLabel={copy.minute}
                menuZIndex={PICKER_SELECT_Z_INDEX}
                menuWidth="trigger"
                triggerClassName={INLINE_SELECT_CLASS_NAME}
                className="min-w-0 flex-1"
              />
            </label>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={clearRange}
            className="ui-press inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            <Icon icon={X} size={12} />
            {copy.clear}
          </button>
          <Button size="sm" disabled={!draftRange} onClick={applyRange}>
            {copy.apply}
          </Button>
        </div>
      </div>
    ) : null;

  const triggerLabel = displayValue || placeholder || copy.selectRange;

  const inlineTriggerClass = inline
    ? `relative inline-flex max-w-[14rem] min-w-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-900 ${
        active
          ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
          : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      }`
    : `ui-press flex w-full min-w-[16rem] cursor-pointer items-center gap-2 ${formControlClassName(size)} text-left text-zinc-900 outline-none transition-[color,background-color,border-color,box-shadow] duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-100 ${triggerSurfaceClass(variant, quiet)}`;

  return (
    <div className={`relative ${className}`.trim()}>
      <button
        ref={triggerRef}
        id={generatedId}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={ariaLabel ?? copy.selectRange}
        aria-pressed={inline ? active : undefined}
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={inlineTriggerClass}
      >
        <Icon icon={CalendarBlank} size={inline ? 14 : quiet ? 14 : 16} className="shrink-0 text-zinc-400" />
        <span
          className={`min-w-0 truncate ${
            displayValue
              ? "text-zinc-900 dark:text-zinc-100"
              : inline
                ? active
                  ? "text-zinc-900 dark:text-zinc-50"
                  : "text-zinc-500 dark:text-zinc-400"
                : "text-zinc-400 dark:text-zinc-600"
          }`}
        >
          {triggerLabel}
        </span>
      </button>

      {typeof document !== "undefined" && panelContent
        ? createPortal(panelContent, document.body)
        : null}
    </div>
  );
}
