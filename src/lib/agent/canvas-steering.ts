import { getRedis } from "@/lib/redis";
import type { CanvasAgentChatAttachment } from "@/lib/agent/canvas-agent-chat";

export type SteerMessage = {
  id: string;
  content: string;
  attachments?: CanvasAgentChatAttachment[];
  createdAt: number;
};

type TurnState = {
  startedAt: number;
  queue: SteerMessage[];
};

/** A turn that has not been touched for this long is considered gone. */
const TURN_TTL_MS = 2 * 60_000;
/** Keep the queue small; a human cannot meaningfully steer more than this. */
const MAX_QUEUED = 8;
const QUEUE_TTL_MS = 10 * 60_000;

const turns = new Map<string, TurnState>();

const turnKey = (key: string) => `canvase:turn:${key}`;
const queueKey = (key: string) => `canvase:steer:${key}`;

function keyOf(input: { canvasId: string; sessionId?: string }): string {
  return `${input.canvasId}:${input.sessionId ?? "-"}`;
}

function sweep(now: number): void {
  for (const [key, state] of turns) {
    if (now - state.startedAt > TURN_TTL_MS) {
      turns.delete(key);
    }
  }
}

/**
 * Marks a streaming turn as steerable. The turn marker is shared through
 * Redis so a steer POST can land on any instance.
 */
export async function beginAgentTurn(input: {
  canvasId: string;
  sessionId?: string;
}): Promise<string> {
  const key = keyOf(input);
  turns.set(key, { startedAt: Date.now(), queue: [] });
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(turnKey(key), "1", "PX", TURN_TTL_MS);
    } catch {
      // Local marker still works for this process.
    }
  }
  return key;
}

export async function endAgentTurn(key: string): Promise<void> {
  turns.delete(key);
  const redis = getRedis();
  if (redis) {
    await Promise.all([
      redis.del(turnKey(key)).catch(() => undefined),
      redis.del(queueKey(key)).catch(() => undefined),
    ]);
  }
}

/**
 * Queue a mid-turn instruction. Returns false when no turn is streaming, so the
 * caller can fall back to a normal message.
 */
export async function queueSteer(
  input: { canvasId: string; sessionId?: string },
  message: SteerMessage,
): Promise<boolean> {
  const key = keyOf(input);
  sweep(Date.now());

  const redis = getRedis();
  if (redis) {
    try {
      const active = await redis.exists(turnKey(key));
      if (!active) {
        // Fall back to the local marker (single instance without shared state).
        const local = turns.get(key);
        if (!local) {
          return false;
        }
        local.queue.push(message);
        if (local.queue.length > MAX_QUEUED) {
          local.queue.shift();
        }
        return true;
      }
      const queue = queueKey(key);
      await redis.rpush(queue, JSON.stringify(message));
      await redis.ltrim(queue, -MAX_QUEUED, -1);
      await redis.pexpire(queue, QUEUE_TTL_MS);
      return true;
    } catch {
      // Fall through to the local path.
    }
  }

  const state = turns.get(key);
  if (!state) {
    return false;
  }
  if (state.queue.length >= MAX_QUEUED) {
    state.queue.shift();
  }
  state.queue.push(message);
  return true;
}

/**
 * Take everything queued so far. Called right before each model step (and
 * before ending a turn) so guidance is never silently dropped. Also refreshes
 * the shared turn marker: the loop is still alive.
 */
export async function drainSteers(key: string): Promise<SteerMessage[]> {
  const redis = getRedis();
  if (redis) {
    try {
      const queue = queueKey(key);
      const raw = await redis.lrange(queue, 0, -1);
      if (raw.length > 0) {
        await redis.del(queue).catch(() => undefined);
      }
      await redis.pexpire(turnKey(key), TURN_TTL_MS).catch(() => undefined);
      if (raw.length > 0) {
        return raw.flatMap((entry) => {
          try {
            return [JSON.parse(entry) as SteerMessage];
          } catch {
            return [];
          }
        });
      }
    } catch {
      // Fall through to the local queue.
    }
  }

  const state = turns.get(key);
  if (!state || state.queue.length === 0) {
    return [];
  }
  const drained = state.queue;
  state.queue = [];
  state.startedAt = Date.now();
  return drained;
}
