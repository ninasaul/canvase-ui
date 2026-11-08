"use client";

import { useMemo } from "react";
import { useCurrencySymbol } from "@/components/currency-provider";
import {
  estimateCanvasGenerationCost,
} from "@/lib/canvas/canvas-generation-cost";
import type { PortalPublicModel } from "@/types/admin";
import { messages } from "@/messages";

type Pricing = NonNullable<PortalPublicModel["pricing"]>;

const TOKEN_UNITS = new Set(["token", "token_1k", "token_1m"]);

export function CanvasGenerationCost({
  pricing,
  kind,
  params,
}: {
  pricing?: Pricing;
  kind: "image" | "video" | "text";
  params?: Record<string, unknown>;
}) {
  const symbol = useCurrencySymbol();
  const label = useMemo(() => {
    if (!pricing) {
      return null;
    }
    if (kind === "text" || TOKEN_UNITS.has(pricing.unit)) {
      return messages.canvas.costTokenBilling;
    }
    const amount = estimateCanvasGenerationCost(
      pricing,
      kind === "video" ? "video" : "image",
      params,
    );
    if (amount === null) {
      return messages.canvas.costByUsage;
    }
    return messages.canvas.costEstimate.replace("{amount}", `${symbol}${amount}`);
  }, [kind, params, pricing, symbol]);

  // "Billed by usage" adds no information next to the other toolbar pills.
  if (!label || label === messages.canvas.costByUsage) {
    return null;
  }
  return (
    <span
      className="shrink-0 text-[10px] tabular-nums text-zinc-400"
      title={messages.canvas.costHint}
    >
      {label}
    </span>
  );
}
