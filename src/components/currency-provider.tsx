"use client";

import { DEFAULT_CURRENCY_SYMBOL } from "@/lib/tu-shared-browser";
import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

type CurrencyContextValue = {
  symbol: string;
  reload: () => void;
};

const CurrencyContext = createContext<CurrencyContextValue>({
  symbol: DEFAULT_CURRENCY_SYMBOL,
  reload: () => undefined,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const value = useMemo(
    () => ({
      symbol: DEFAULT_CURRENCY_SYMBOL,
      reload: () => undefined,
    }),
    [],
  );
  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrencySymbol(): string {
  return useContext(CurrencyContext).symbol;
}

export function useCurrencySettings(): CurrencyContextValue {
  return useContext(CurrencyContext);
}
