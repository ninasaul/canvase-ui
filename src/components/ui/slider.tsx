"use client";

import { useCallback, useId, type ChangeEvent } from "react";

const TRACK_CLASS =
  "pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-zinc-200 dark:bg-zinc-700";

const FILL_CLASS =
  "pointer-events-none absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-zinc-900 dark:bg-zinc-100";

const THUMB_CLASS =
  "relative z-10 h-5 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed disabled:opacity-60 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-zinc-200 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-sm [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-200 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm dark:[&::-moz-range-thumb]:border-zinc-700 dark:[&::-moz-range-thumb]:bg-zinc-950 dark:[&::-webkit-slider-thumb]:border-zinc-700 dark:[&::-webkit-slider-thumb]:bg-zinc-950";

export type SliderProps = {
  id?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  /** Show min / current / max below the track. */
  showValue?: boolean;
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toPercent(value: number, min: number, max: number): number {
  if (max <= min) {
    return 0;
  }
  return ((clamp(value, min, max) - min) / (max - min)) * 100;
}

export function Slider({
  id,
  value,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  className = "",
  showValue = true,
  formatValue = (next) => String(next),
  onChange,
}: SliderProps) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const percent = toPercent(value, min, max);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const next = Number(event.target.value);
      if (Number.isFinite(next)) {
        onChange(next);
      }
    },
    [onChange],
  );

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <div className="relative flex h-5 items-center">
        <div className={TRACK_CLASS} aria-hidden />
        <div className={FILL_CLASS} style={{ width: `${percent}%` }} aria-hidden />
        <input
          id={inputId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          className={THUMB_CLASS}
          onChange={handleChange}
        />
      </div>
      {showValue ? (
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>{formatValue(min)}</span>
          <span className="font-medium tabular-nums text-zinc-700 dark:text-zinc-200">
            {formatValue(value)}
          </span>
          <span>{formatValue(max)}</span>
        </div>
      ) : null}
    </div>
  );
}
