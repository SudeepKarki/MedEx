"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface RangeSliderProps {
  min: number;
  max: number;
  step: number;
  value: [number, number];
  /** Called continuously while dragging (for live labels). */
  onInput?: (value: [number, number]) => void;
  /** Called once the customer lets go (or pauses on the keyboard). */
  onCommit: (value: [number, number]) => void;
  labels: [string, string];
  /** Spoken value, e.g. "THB 5,000". */
  formatValue: (value: number) => string;
  className?: string;
}

const KEYBOARD_COMMIT_DELAY_MS = 400;

/**
 * Two-thumb range made of two native <input type="range">. Keyboard support
 * (arrows, Page Up/Down, Home/End) and screen-reader semantics come for free,
 * and unlike a scripted slider it never measures the DOM while rendering.
 */
export function RangeSlider({
  min,
  max,
  step,
  value,
  onInput,
  onCommit,
  labels,
  formatValue,
  className,
}: RangeSliderProps) {
  const [draft, setDraft] = useState<[number, number] | null>(null);
  const current = draft ?? value;
  const timer = useRef<number | undefined>(undefined);
  const dragging = useRef(false);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const update = (next: [number, number], commitSoon: boolean) => {
    setDraft(next);
    onInput?.(next);
    window.clearTimeout(timer.current);
    if (commitSoon) timer.current = window.setTimeout(() => commit(next), KEYBOARD_COMMIT_DELAY_MS);
  };
  const commit = (next: [number, number] = current) => {
    window.clearTimeout(timer.current);
    setDraft(null);
    onCommit(next);
  };

  const pct = (v: number) => ((Math.min(Math.max(v, min), max) - min) / (max - min || 1)) * 100;

  const thumb = (index: 0 | 1) => (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={current[index]}
      aria-label={labels[index]}
      aria-valuetext={formatValue(current[index])}
      onChange={(e) => {
        const v = Number(e.target.value);
        const next: [number, number] =
          index === 0
            ? [Math.min(v, current[1]), current[1]]
            : [current[0], Math.max(v, current[0])];
        // Pointer drags commit on release; keyboard changes after a short pause
        update(next, !dragging.current);
      }}
      onPointerDown={() => (dragging.current = true)}
      onPointerUp={() => {
        dragging.current = false;
        commit();
      }}
      className={cn(
        "dual-range absolute inset-0 h-full w-full",
        // The lower thumb sits on top when both are at the far right
        index === 0 && current[0] >= max - step && "z-10",
      )}
    />
  );

  return (
    <div className={cn("relative h-6", className)}>
      <div
        aria-hidden
        className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted"
      />
      <div
        aria-hidden
        className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary"
        style={{ left: `${pct(current[0])}%`, right: `${100 - pct(current[1])}%` }}
      />
      {thumb(0)}
      {thumb(1)}
    </div>
  );
}
