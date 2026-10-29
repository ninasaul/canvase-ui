/** Slim stub of tu_api model-pricing for canvas playground model select. */

export type PricingUnit =
  | "token"
  | "token_1k"
  | "token_1m"
  | "image"
  | "request"
  | "second";

export function formatCustomerPriceSummary(
  _capability: string,
  pricing: {
    customerAmount?: string | null;
    customerInputAmount?: string | null;
    customerOutputAmount?: string | null;
    customerUnit?: PricingUnit | string | null;
    priceTable?: unknown;
  },
  _symbol: string,
): { amount: string; unit: string } {
  const amount = pricing.customerAmount?.trim() || "";
  return { amount, unit: "" };
}
