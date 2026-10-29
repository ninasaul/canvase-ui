import type { PortalPublicModel } from "@/types/admin";

type Pricing = NonNullable<PortalPublicModel["pricing"]>;

const SCALE = 1_000_000n;
const TOKEN_UNITS = new Set(["token", "token_1k", "token_1m"]);

function parseScaled(value: unknown): bigint | null {
  const text = typeof value === "number" ? String(value) : value;
  if (typeof text !== "string") {
    return null;
  }
  const match = text.trim().match(/^(\d+)(?:\.(\d{1,6}))?$/);
  if (!match) {
    return null;
  }
  const whole = BigInt(match[1] ?? "0");
  const fraction = BigInt(((match[2] ?? "") + "000000").slice(0, 6));
  return whole * SCALE + fraction;
}

function mulScaled(left: bigint, right: bigint): bigint {
  // Prices are non-negative, so round any sub-micro remainder up.
  return (left * right + SCALE - BigInt(1)) / SCALE;
}

function positiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1
    ? Math.max(1, Math.floor(parsed))
    : fallback;
}

/** Format a scaled decimal as a fixed 2-decimal amount, rounded up. */
export function formatCanvasCost(value: bigint): string {
  if (value <= BigInt(0)) {
    return "0.00";
  }
  const cents = (value + 9_999n) / 10_000n;
  const whole = cents / BigInt(100);
  const fraction = (cents % BigInt(100)).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function estimateCanvasGenerationCost(
  pricing: Pricing | undefined,
  kind: "image" | "video",
  params: Record<string, unknown> | undefined,
): string | null {
  if (!pricing || TOKEN_UNITS.has(pricing.unit)) {
    return null;
  }
  const amount = parseScaled(pricing.amount);
  if (amount === null) {
    return null;
  }

  if (kind === "image") {
    const count = positiveInt(params?.count, 1);
    const size = typeof params?.size === "string" ? params.size : "";
    const multiplierValue = pricing.size_multipliers?.[size] ?? 1;
    const multiplier = parseScaled(multiplierValue);
    if (multiplier === null) {
      return null;
    }
    const quantity = pricing.unit === "request" ? BigInt(1) : BigInt(count);
    return formatCanvasCost(mulScaled(mulScaled(amount, multiplier), quantity * SCALE));
  }

  const duration = positiveInt(
    typeof params?.duration === "string"
      ? params.duration
      : (params?.seconds ?? params?.duration),
    5,
  );
  const resolution =
    typeof params?.resolution === "string" ? params.resolution : "720p";
  const table = pricing.price_table;

  if (table) {
    const row =
      table.rates[resolution] ??
      table.rates["*"];
    if (row) {
      const cell =
        row[String(duration)] ??
        row["*"];
      if (cell) {
        const rate = parseScaled(cell.customer);
        if (rate !== null) {
          return formatCanvasCost(
            table.mode === "per_second" ? rate * BigInt(duration) : rate,
          );
        }
      }
    }
    return null;
  }

  if (pricing.unit === "second") {
    return formatCanvasCost(amount * BigInt(duration));
  }
  if (pricing.unit === "request") {
    return formatCanvasCost(amount);
  }
  return null;
}
