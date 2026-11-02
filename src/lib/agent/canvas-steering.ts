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

/** A turn that has not touched its entry for this long is considered gone. */
const TURN_TTL_MS = 10 * 60_000;
/** Keep the queue small; a human cannot meaningfully steer more than this. */
const MAX_QUEUED = 8;

const turns = new Map<string, TurnState>();

function turnKey(input: { canvasId: string; sessionId?: string }): string {
  return `${input.canvasId}:${input.sessionId ?? "-"}`;
}

function sweep(now: number): void {
  for (const [key, state] of turns) {
    if (now - state.startedAt > TURN_TTL_MS) {
      turns.delete(key);
    }
  }
}

/** Marks a streaming turn as steerable. */
export function beginAgentTurn(input: {
  canvasId: string;
  sessionId?: string;
}): string {
  const key = turnKey(input);
  turns.set(key, { startedAt: Date.now(), queue: [] });
  return key;
}

export function endAgentTurn(key: string): void {
  turns.delete(key);
}

export function isAgentTurnActive(input: {
  canvasId: string;
  sessionId?: string;
}): boolean {
  sweep(Date.now());
  return turns.has(turnKey(input));
}

/**
 * Queue a mid-turn instruction. Returns false when no turn is streaming, so the
 * caller can fall back to a normal message.
 */
export function queueSteer(
  input: { canvasId: string; sessionId?: string },
  message: SteerMessage,
): boolean {
  sweep(Date.now());
  const state = turns.get(turnKey(input));
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
 * before ending a turn) so guidance is never silently dropped.
 */
export function drainSteers(key: string): SteerMessage[] {
  const state = turns.get(key);
  if (!state || state.queue.length === 0) {
    return [];
  }
  const drained = state.queue;
  state.queue = [];
  state.startedAt = Date.now();
  return drained;
}
