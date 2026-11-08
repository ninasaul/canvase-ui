"use client";

import { useEffect, useState } from "react";

export type TypewriterTextProps = {
  /** Full string to type out. The rendered box is always sized for it. */
  text: string;
  /** ms per character while typing. */
  typeSpeed?: number;
  /** ms per character while deleting. */
  deleteSpeed?: number;
  /** How long the finished line stays on screen. */
  holdMs?: number;
  /** Idle gap between wiping out and typing again. */
  restartMs?: number;
  /** Delay before the first keystroke (lets entrance animations finish). */
  startMs?: number;
  className?: string;
  caretClassName?: string;
};

type Motion = "pending" | "running" | "off";

/**
 * Types `text` out, holds, deletes it, and loops.
 *
 * The full string is rendered invisibly in normal flow so the box never
 * shrinks — nothing below it moves while characters come and go. Under
 * `prefers-reduced-motion` the line is shown in full, with no caret.
 */
export function TypewriterText({
  text,
  typeSpeed = 55,
  deleteSpeed = 22,
  holdMs = 2600,
  restartMs = 700,
  startMs = 800,
  className = "",
  caretClassName = "",
}: TypewriterTextProps) {
  const [motion, setMotion] = useState<Motion>("pending");
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMotion(query.matches ? "off" : "running");
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (motion === "pending") {
      return;
    }
    if (motion === "off") {
      setVisibleCount(text.length);
      return;
    }

    let count = 0;
    let timer = 0;
    let phase: "typing" | "holding" | "deleting" | "pausing" = "typing";

    setVisibleCount(0);

    const step = () => {
      if (phase === "typing") {
        count += 1;
        setVisibleCount(count);
        if (count >= text.length) {
          phase = "holding";
          timer = window.setTimeout(step, holdMs);
        } else {
          timer = window.setTimeout(step, typeSpeed);
        }
        return;
      }

      if (phase === "holding") {
        phase = "deleting";
        timer = window.setTimeout(step, deleteSpeed);
        return;
      }

      if (phase === "deleting") {
        count -= 1;
        setVisibleCount(count);
        if (count <= 0) {
          phase = "pausing";
          timer = window.setTimeout(step, restartMs);
        } else {
          timer = window.setTimeout(step, deleteSpeed);
        }
        return;
      }

      phase = "typing";
      timer = window.setTimeout(step, typeSpeed);
    };

    timer = window.setTimeout(step, startMs);
    return () => window.clearTimeout(timer);
  }, [deleteSpeed, holdMs, motion, restartMs, startMs, text, typeSpeed]);

  const shown = motion === "off" ? text : text.slice(0, visibleCount);

  return (
    <span className={`relative block ${className}`.trim()}>
      {/* Reserves the final height; also keeps the full string in the DOM. */}
      <span aria-hidden className="invisible">
        {text}
      </span>
      <span aria-hidden className="absolute inset-0">
        {shown}
        {motion === "off" ? null : (
          <span className={`ui-caret ${caretClassName}`.trim()} />
        )}
      </span>
    </span>
  );
}
