import {
  formatCustomerPriceSummary,
  type PricingUnit,
} from "@/lib/model-pricing";
import type { PortalPublicModel } from "@/types/admin";

const PRICING_UNITS = [
  "token",
  "token_1k",
  "token_1m",
  "image",
  "request",
  "second",
] as const satisfies readonly PricingUnit[];

function asPricingUnit(unit: string | undefined): PricingUnit {
  if (unit && (PRICING_UNITS as readonly string[]).includes(unit)) {
    return unit as PricingUnit;
  }
  return "request";
}

function portalPricingForSummary(model: PortalPublicModel) {
  const pricing = model.pricing!;
  const priceTable = pricing.price_table;

  return {
    customerAmount: pricing.amount,
    customerInputAmount: pricing.input_amount ?? null,
    customerOutputAmount: pricing.output_amount ?? null,
    customerUnit: asPricingUnit(pricing.unit),
    priceTable: priceTable
      ? {
          mode: priceTable.mode,
          rates: Object.fromEntries(
            Object.entries(priceTable.rates).map(([resolution, durations]) => [
              resolution,
              durations
                ? Object.fromEntries(
                    Object.entries(durations).map(([duration, rate]) => [
                      duration,
                      rate
                        ? { customer: rate.customer, upstream: "" }
                        : rate,
                    ]),
                  )
                : durations,
            ]),
          ),
        }
      : null,
  };
}

/** Customer-facing price line for playground model pickers (amount + billing mode). */
export function summarizePortalModelPrice(
  model: PortalPublicModel | undefined,
  symbol: string,
): string | null {
  if (!model?.pricing) {
    return null;
  }

  const summary = formatCustomerPriceSummary(
    model.capability,
    portalPricingForSummary(model),
    symbol,
  );

  return summary.unit
    ? `${summary.amount} · ${summary.unit}`
    : summary.amount;
}
