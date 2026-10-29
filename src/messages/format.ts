export type MessageValues = Record<string, string | number>;

/** Replace `{name}` placeholders in a message template. */
export function formatMessage(
  template: string,
  values: MessageValues = {},
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values[key];
    return value === undefined || value === null ? `{${key}}` : String(value);
  });
}
