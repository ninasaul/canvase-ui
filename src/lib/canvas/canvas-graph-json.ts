/** Stable JSON for graph equality; PostgreSQL JSONB reorders object keys. */
export function stableGraphJson(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableGraphJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableGraphJson(record[key])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
