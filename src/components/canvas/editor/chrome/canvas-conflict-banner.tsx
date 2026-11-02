"use client";

import { Button } from "@/components/ui/button";
import { messages } from "@/messages";

/** Banner shown when the server version moved on under an unsaved edit. */
export function CanvasConflictBanner({
  open,
  onKeepMine,
  onLoadRemote,
}: {
  open: boolean;
  onKeepMine: () => void;
  onLoadRemote: () => void;
}) {
  if (!open) {
    return null;
  }
  return (
    <div className="pointer-events-auto absolute left-1/2 top-16 z-30 flex w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[11px] text-amber-800 shadow-lg backdrop-blur-xl dark:border-amber-900/60 dark:bg-amber-950/80 dark:text-amber-200">
      <span className="min-w-0 flex-1 truncate">
        {messages.canvas.versionConflictBody}
      </span>
      <Button variant="secondary" size="sm" onClick={onKeepMine}>
        {messages.canvas.versionConflictKeepMine}
      </Button>
      <Button variant="ghost" size="sm" onClick={onLoadRemote}>
        {messages.canvas.conflictLoadRemote}
      </Button>
    </div>
  );
}
