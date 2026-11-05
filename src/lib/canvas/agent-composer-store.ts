"use client";

import { create } from "zustand";

export type QueuedSkill = { id: string; name: string; content: string };

type AgentComposerState = {
  /** Skill picked outside the composer (e.g. the settings tab). */
  queued: QueuedSkill | null;
  queueSkill: (skill: QueuedSkill) => void;
  consumeSkill: () => QueuedSkill | null;
};

/**
 * Hands a skill from a panel to the agent composer without threading props
 * through the editor. The composer drains the queue once and renders it as a
 * removable chip, exactly like a skill picked with "/".
 */
export const useAgentComposerStore = create<AgentComposerState>((set, get) => ({
  queued: null,
  queueSkill: (skill) => set({ queued: skill }),
  consumeSkill: () => {
    const queued = get().queued;
    if (queued) {
      set({ queued: null });
    }
    return queued;
  },
}));
