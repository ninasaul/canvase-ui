import { getIntlLocale } from "@/messages";

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat(getIntlLocale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatShortDate(
  value: string | Date | null | undefined,
): string {
  if (!value) {
    return "—";
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat(getIntlLocale(), {
    ...(sameYear ? {} : { year: "numeric" as const }),
    month: "short",
    day: "numeric",
  }).format(date);
}

export function fillTemplate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(vars[key] ?? ""),
  );
}

export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "0";
  }
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) {
    return String(value);
  }
  return numberValue.toLocaleString(getIntlLocale(), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

export function formatLedgerAmount(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined || value === "") {
    return "0.00";
  }
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) {
    return String(value);
  }
  return numberValue.toLocaleString(getIntlLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCurrency(
  value: string | number | null | undefined,
  symbol: string,
): string {
  return `${symbol}${formatLedgerAmount(value)}`;
}

/** 单价/配价展示：保留 0–6 位小数，前缀系统法币符号。 */
export function formatMoneyWithSymbol(
  value: string | number | null | undefined,
  symbol: string,
): string {
  return `${symbol}${formatMoney(value)}`;
}

export function formatCount(value: number): string {
  return value.toLocaleString(getIntlLocale());
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatSignedPercent(value: number): string {
  const percent = `${(Math.abs(value) * 100).toFixed(1)}%`;
  if (value > 0) {
    return `+${percent}`;
  }
  if (value < 0) {
    return `-${percent}`;
  }
  return percent;
}

export function formatDuration(milliseconds: number | null | undefined): string {
  if (milliseconds === null || milliseconds === undefined) {
    return "—";
  }
  if (milliseconds < 1000) {
    return `${milliseconds} ms`;
  }
  return `${(milliseconds / 1000).toFixed(2)} s`;
}

/** prompt / completion；都为空时返回 null（列表可显示 —）。数字带千分位。 */
export function formatTokenUsage(
  promptTokens: number | null | undefined,
  completionTokens: number | null | undefined,
): string | null {
  if (promptTokens == null && completionTokens == null) {
    return null;
  }
  return `${formatCount(promptTokens ?? 0)} / ${formatCount(completionTokens ?? 0)}`;
}
