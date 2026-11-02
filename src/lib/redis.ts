import Redis from "ioredis";

/**
 * Shared Redis connection for cross-instance coordination (approvals,
 * steering). Returns null when Redis is not configured or unreachable so the
 * callers can fall back to process-local state in single-instance setups.
 */
type RedisGlobal = typeof globalThis & {
  __canvaseRedis?: Redis | null;
  __canvaseRedisSub?: Redis | null;
  __canvaseRedisFailed?: boolean;
};

const globalForRedis = globalThis as RedisGlobal;

function connect(): Redis | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    return null;
  }
  try {
    const client = new Redis(url, {
      maxRetriesPerRequest: 2,
      connectTimeout: 2_000,
      // Queue commands while the connection opens: the first approval after a
      // restart must not silently degrade to process-local state.
      enableOfflineQueue: true,
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2_000)),
    });
    // Prevent unhandled error events from crashing the request path.
    client.on("error", () => undefined);
    return client;
  } catch {
    return null;
  }
}

export function getRedis(): Redis | null {
  if (globalForRedis.__canvaseRedisFailed) {
    return null;
  }
  if (globalForRedis.__canvaseRedis) {
    return globalForRedis.__canvaseRedis;
  }
  const client = connect();
  if (!client) {
    globalForRedis.__canvaseRedisFailed = true;
    return null;
  }
  globalForRedis.__canvaseRedis = client;
  return client;
}

/** Dedicated connection for pub/sub (a subscribed client cannot run commands). */
export function getRedisSubscriber(): Redis | null {
  if (globalForRedis.__canvaseRedisFailed) {
    return null;
  }
  if (globalForRedis.__canvaseRedisSub) {
    return globalForRedis.__canvaseRedisSub;
  }
  const client = connect();
  if (!client) {
    globalForRedis.__canvaseRedisFailed = true;
    return null;
  }
  globalForRedis.__canvaseRedisSub = client;
  return client;
}

/** True when coordination state is shared across instances. */
export function isRedisShared(): boolean {
  return Boolean(getRedis());
}
