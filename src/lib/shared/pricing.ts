const scale = 1_000_000n;

export const pricingUnits = [
  "token",
  "token_1k",
  "token_1m",
  "image",
  "request",
  "second",
] as const;

export type PricingUnit = (typeof pricingUnits)[number];

const tokenPricingUnits = new Set<PricingUnit>(["token", "token_1k", "token_1m"]);

export function isTokenPricingUnit(unit: PricingUnit): boolean {
  return tokenPricingUnits.has(unit);
}

export type PricingSnapshot = {
  currency: string;
  customerUnit: PricingUnit;
  customerAmount: string;
  upstreamUnit: PricingUnit;
  upstreamAmount: string;
  customerInputAmount: string | null;
  customerOutputAmount: string | null;
  customerImageInputAmount: string | null;
  upstreamInputAmount: string | null;
  upstreamOutputAmount: string | null;
  upstreamImageInputAmount: string | null;
  sizeMultipliers: Record<string, string | number> | null;
};

export type ChargeResult = {
  customerCharge: string;
  upstreamCost: string;
  currency: string;
};

function parseDecimal(value: string): bigint {
  const trimmed = value.trim();
  const match = trimmed.match(/^(-)?(\d+)(?:\.(\d{1,6}))?$/);
  if (!match) {
    throw new Error("invalid decimal");
  }
  const sign = match[1] === "-" ? -BigInt(1) : BigInt(1);
  const whole = BigInt(match[2] ?? "0");
  const fraction = ((match[3] ?? "") + "000000").slice(0, 6);
  return sign * (whole * scale + BigInt(fraction));
}

function formatDecimal(units: bigint): string {
  const sign = units < BigInt(0) ? "-" : "";
  const absolute = units < BigInt(0) ? -units : units;
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(6, "0").replace(/0+$/, "");
  if (!fraction) {
    return `${sign}${whole.toString()}`;
  }
  return `${sign}${whole.toString()}.${fraction}`;
}

function readMultiplier(
  sizeMultipliers: Record<string, string | number> | null,
  size: string | undefined,
): string {
  if (!size || !sizeMultipliers) {
    return "1";
  }
  const raw = sizeMultipliers[size];
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(raw);
  }
  if (typeof raw === "string" && raw.length > 0) {
    return raw;
  }
  return "1";
}

function tokenDivisor(unit: PricingUnit): bigint {
  if (unit === "token") {
    return BigInt(1);
  }
  if (unit === "token_1m") {
    return 1_000_000n;
  }
  return BigInt(1000);
}

export function computeTokenCharge(
  pricing: PricingSnapshot,
  promptTokens: number,
  completionTokens: number,
): ChargeResult {
  const safePrompt = Math.max(0, promptTokens);
  const safeCompletion = Math.max(0, completionTokens);
  const customerInput = pricing.customerInputAmount ?? pricing.customerAmount;
  const customerOutput = pricing.customerOutputAmount ?? pricing.customerAmount;
  const upstreamInput = pricing.upstreamInputAmount ?? pricing.upstreamAmount;
  const upstreamOutput = pricing.upstreamOutputAmount ?? pricing.upstreamAmount;
  const customerDivisor = tokenDivisor(pricing.customerUnit);
  const upstreamDivisor = tokenDivisor(pricing.upstreamUnit);
  const customer =
    (parseDecimal(customerInput) * BigInt(safePrompt) +
      parseDecimal(customerOutput) * BigInt(safeCompletion)) /
    customerDivisor;
  const upstream =
    (parseDecimal(upstreamInput) * BigInt(safePrompt) +
      parseDecimal(upstreamOutput) * BigInt(safeCompletion)) /
    upstreamDivisor;
  return {
    customerCharge: formatDecimal(customer),
    upstreamCost: formatDecimal(upstream),
    currency: pricing.currency,
  };
}

/**
 * Media token billing (scheme A):
 * text input + image input + output.
 * Without input details, all prompt tokens bill at the image-input rate.
 */
export function computeMediaTokenCharge(
  pricing: PricingSnapshot,
  usage: {
    promptTokens: number;
    completionTokens: number;
    promptTextTokens?: number | null;
    promptImageTokens?: number | null;
  },
): ChargeResult {
  const hasInputSplit =
    usage.promptTextTokens != null || usage.promptImageTokens != null;
  const textInputTokens = hasInputSplit
    ? Math.max(0, usage.promptTextTokens ?? 0)
    : 0;
  const imageInputTokens = hasInputSplit
    ? Math.max(0, usage.promptImageTokens ?? 0)
    : Math.max(0, usage.promptTokens);
  const outputTokens = Math.max(0, usage.completionTokens);

  const customerTextInput =
    pricing.customerInputAmount ?? pricing.customerAmount;
  const customerImageInput =
    pricing.customerImageInputAmount ??
    pricing.customerInputAmount ??
    pricing.customerAmount;
  const customerOutput = pricing.customerOutputAmount ?? pricing.customerAmount;
  const upstreamTextInput =
    pricing.upstreamInputAmount ?? pricing.upstreamAmount;
  const upstreamImageInput =
    pricing.upstreamImageInputAmount ??
    pricing.upstreamInputAmount ??
    pricing.upstreamAmount;
  const upstreamOutput = pricing.upstreamOutputAmount ?? pricing.upstreamAmount;

  const customerDivisor = tokenDivisor(pricing.customerUnit);
  const upstreamDivisor = tokenDivisor(pricing.upstreamUnit);
  const customer =
    (parseDecimal(customerTextInput) * BigInt(textInputTokens) +
      parseDecimal(customerImageInput) * BigInt(imageInputTokens) +
      parseDecimal(customerOutput) * BigInt(outputTokens)) /
    customerDivisor;
  const upstream =
    (parseDecimal(upstreamTextInput) * BigInt(textInputTokens) +
      parseDecimal(upstreamImageInput) * BigInt(imageInputTokens) +
      parseDecimal(upstreamOutput) * BigInt(outputTokens)) /
    upstreamDivisor;
  return {
    customerCharge: formatDecimal(customer),
    upstreamCost: formatDecimal(upstream),
    currency: pricing.currency,
  };
}

export function computeQuantityCharge(
  pricing: PricingSnapshot,
  quantity: number,
  size?: string,
): ChargeResult {
  const safeQuantity = Math.max(0, quantity);
  const multiplier = readMultiplier(pricing.sizeMultipliers, size);
  const customer =
    (parseDecimal(pricing.customerAmount) *
      BigInt(safeQuantity) *
      parseDecimal(multiplier)) /
    scale;
  const upstream =
    (parseDecimal(pricing.upstreamAmount) *
      BigInt(safeQuantity) *
      parseDecimal(multiplier)) /
    scale;
  return {
    customerCharge: formatDecimal(customer),
    upstreamCost: formatDecimal(upstream),
    currency: pricing.currency,
  };
}
