"use client";

import { useMemo, useRef, useState } from "react";
import {
  SolidPauseIcon,
  SolidPlayIcon,
} from "@/components/canvas/canvas-media-icons";
import { messages } from "@/messages";

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Deterministic, smooth envelope from the source URL for a natural-looking waveform. */
function createWaveform(seedSource: string, count = 48): number[] {
  let state = hashString(seedSource) || 1;
  let smooth = 0.45;
  const bars: number[] = [];
  for (let index = 0; index < count; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const random = state / 4294967296;
    smooth = smooth * 0.62 + random * 0.38;
    const envelope =
      0.72 + 0.28 * Math.sin((index / count) * Math.PI * 3 + 0.8);
    bars.push(Math.min(1, Math.max(0.18, smooth * envelope)));
  }
  return bars;
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return "0:00";
  }
  const total = Math.floor(value);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Minimal waveform audio player; the native audio element stays hidden. */
export function CanvasAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const seekStartXRef = useRef<number | null>(null);

  const progress =
    duration > 0 ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;
  const waveform = useMemo(() => createWaveform(src), [src]);
  const activeBars = Math.round((progress / 100) * waveform.length);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setPlaying(false);
      }
    } else {
      audio.pause();
    }
  }

  function seekTo(clientX: number, element: HTMLElement) {
    const audio = audioRef.current;
    const rect = element.getBoundingClientRect();
    if (!audio || duration <= 0 || rect.width <= 0) {
      return;
    }
    const ratio = Math.min(
      1,
      Math.max(0, (clientX - rect.left) / rect.width),
    );
    audio.currentTime = ratio * duration;
    setCurrent(audio.currentTime);
  }

  return (
    <div className="canvas-audio-player flex h-full items-center gap-3">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          setDuration(Number.isFinite(value) ? value : 0);
        }}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
      />

      <button
        type="button"
        className="nodrag inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white shadow-[0_6px_16px_-8px_rgba(24,24,27,0.8)] ring-1 ring-white/10 transition-transform duration-200 hover:scale-105 hover:bg-zinc-800 active:scale-95 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        aria-label={playing ? messages.canvas.audioPause : messages.canvas.audioPlay}
        title={playing ? messages.canvas.audioPause : messages.canvas.audioPlay}
        onClick={() => void toggle()}
      >
        {playing ? (
          <SolidPauseIcon size={14} />
        ) : (
          <SolidPlayIcon size={14} />
        )}
      </button>

      <div
        role="slider"
        tabIndex={0}
        aria-label={messages.canvas.audioProgress}
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={current}
        className="group/wave flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-[2px]"
        onPointerDown={(event) => {
          seekStartXRef.current = event.clientX;
        }}
        onClick={(event) => {
          const startX = seekStartXRef.current;
          seekStartXRef.current = null;
          if (startX === null || Math.abs(event.clientX - startX) > 4) {
            return;
          }
          seekTo(event.clientX, event.currentTarget);
        }}
        onKeyDown={(event) => {
          const audio = audioRef.current;
          if (!audio || duration <= 0) {
            return;
          }
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            const delta = event.key === "ArrowRight" ? 5 : -5;
            audio.currentTime = Math.min(
              duration,
              Math.max(0, audio.currentTime + delta),
            );
            setCurrent(audio.currentTime);
          }
        }}
      >
        {waveform.map((height, index) => (
          <span
            key={index}
            className={`min-w-px flex-1 rounded-full transition-colors duration-150 ${
              index < activeBars
                ? "bg-zinc-800 dark:bg-zinc-100"
                : "bg-zinc-200 group-hover/wave:bg-zinc-300 dark:bg-zinc-700 dark:group-hover/wave:bg-zinc-600"
            }`}
            style={{ height: `${Math.round(height * 100)}%` }}
          />
        ))}
      </div>

      <span className="shrink-0 text-xs font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
        {formatTime(duration)}
      </span>
    </div>
  );
}
