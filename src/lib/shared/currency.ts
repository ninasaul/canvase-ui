export const DEFAULT_CURRENCY_SYMBOL = "¥";
export const DEFAULT_CURRENCY_CODE = "CNY";

export const currencySymbolPresets = ["yuan", "dollar", "custom"] as const;
export type CurrencySymbolPreset = (typeof currencySymbolPresets)[number];

const YUAN_SYMBOLS = new Set(["¥", "￥"]);

export function currencyPresetFromSymbol(symbol: string): CurrencySymbolPreset {
  const trimmed = symbol.trim();
  if (YUAN_SYMBOLS.has(trimmed)) {
    return "yuan";
  }
  if (trimmed === "$") {
    return "dollar";
  }
  return "custom";
}

export function currencySymbolFromPreset(
  preset: CurrencySymbolPreset,
  custom = "",
): string {
  if (preset === "yuan") {
    return "¥";
  }
  if (preset === "dollar") {
    return "$";
  }
  return custom.trim();
}

export function currencyCodeFromSymbol(symbol: string): string {
  switch (currencyPresetFromSymbol(symbol)) {
    case "yuan":
      return "CNY";
    case "dollar":
      return "USD";
    default:
      return DEFAULT_CURRENCY_CODE;
  }
}

export function normalizeCurrencySymbol(symbol: string): string {
  const trimmed = symbol.trim();
  if (!trimmed) {
    return DEFAULT_CURRENCY_SYMBOL;
  }
  return Array.from(trimmed).slice(0, 8).join("");
}
