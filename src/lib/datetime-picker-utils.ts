import { getIntlLocale } from "@/messages";

export type CalendarCell = {
  date: Date;
  inCurrentMonth: boolean;
  isoDay: string;
};

export function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function toIsoDay(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Parse picker / `datetime-local` values. Naive strings follow local time. */
export function parseDateTimeValue(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** `YYYY-MM-DDTHH:mm` in the local timezone. */
export function formatDateTimeValue(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatDisplayDateTime(
  value: string,
  locale: string = getIntlLocale(),
) {
  const parsed = parseDateTimeValue(value);
  if (!parsed) {
    return "";
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function localDayTime(date: Date): number {
  return startOfLocalDay(date).getTime();
}

export function isSameLocalDay(left: Date, right: Date): boolean {
  return localDayTime(left) === localDayTime(right);
}

export function isDayInLocalRange(
  day: Date,
  from: Date | null,
  to: Date | null,
): boolean {
  if (!from || !to) {
    return false;
  }
  const value = localDayTime(day);
  const start = localDayTime(from);
  const end = localDayTime(to);
  const min = Math.min(start, end);
  const max = Math.max(start, end);
  return value >= min && value <= max;
}

export function formatDisplayDateRange(
  from: string,
  to: string,
  locale: string = getIntlLocale(),
) {
  const start = formatDisplayDateTime(from, locale);
  const end = formatDisplayDateTime(to, locale);
  if (!start && !end) {
    return "";
  }
  if (start && !end) {
    return start;
  }
  if (!start && end) {
    return end;
  }
  return `${start} — ${end}`;
}

/** Compact toolbar label, e.g. `08/17 00:00 — 08/23 15:30`. */
export function formatDisplayDateRangeCompact(
  from: string,
  to: string,
  locale: string = getIntlLocale(),
) {
  const parsedFrom = parseDateTimeValue(from);
  const parsedTo = parseDateTimeValue(to);
  if (!parsedFrom || !parsedTo) {
    return formatDisplayDateRange(from, to, locale);
  }
  const fmt = new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${fmt.format(parsedFrom)} — ${fmt.format(parsedTo)}`;
}

export function applyClockToDay(
  day: Date,
  hour: string,
  minute: string,
): Date {
  const next = new Date(day);
  next.setHours(Number(hour), Number(minute), 0, 0);
  return next;
}

export function parseClockTime(value: string | undefined): { hour: string; minute: string } | null {
  if (!value) {
    return null;
  }
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return null;
  }
  return { hour: match[1], minute: match[2] };
}

export function buildCalendarGrid(
  year: number,
  month: number,
  weekStartsOn: 0 | 1,
): CalendarCell[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() - weekStartsOn + 7) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      date,
      inCurrentMonth: date.getMonth() === month,
      isoDay: toIsoDay(date),
    };
  });
}

export function getWeekdayLabels(
  locale: string = getIntlLocale(),
  weekStartsOn: 0 | 1 = 1,
) {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const labels: string[] = [];
  for (let index = 0; index < 7; index += 1) {
    const day = (weekStartsOn + index) % 7;
    const reference = new Date(2024, 0, day === 0 ? 7 : day);
    labels.push(formatter.format(reference));
  }
  return labels;
}

export function formatMonthTitle(
  year: number,
  month: number,
  locale: string = getIntlLocale(),
) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
  }).format(new Date(year, month, 1));
}

export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => pad2(index));
export const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => pad2(index));
