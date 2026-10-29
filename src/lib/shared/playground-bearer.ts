export const PLAYGROUND_BEARER_PREFIX = "sk_pg_";
export const PLAYGROUND_BEARER_REDIS_PREFIX = "playground:bearer:";

export function playgroundBearerRedisKey(token: string): string {
  return `${PLAYGROUND_BEARER_REDIS_PREFIX}${token}`;
}
