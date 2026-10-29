export const AGENT_SCOPES = [
  "canvas:read",
  "canvas:edit",
  "canvas:run",
  "assets:read",
  "assets:write",
] as const;

export type AgentScope = (typeof AGENT_SCOPES)[number];

export const AGENT_P0_SCOPES: AgentScope[] = [
  "canvas:read",
  "canvas:edit",
  "canvas:run",
];

export function isAgentScope(value: string): value is AgentScope {
  return (AGENT_SCOPES as readonly string[]).includes(value);
}

export function hasAgentScope(
  scopes: readonly string[],
  required: AgentScope,
): boolean {
  return scopes.includes(required);
}
