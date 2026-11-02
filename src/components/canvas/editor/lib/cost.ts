/** "12.34" → 1234n, so estimates can be summed without float drift. */
export function costToCents(value: string): bigint {
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt((fraction + "00").slice(0, 2));
}
