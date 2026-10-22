"use client";

import { create } from "zustand";

export interface DevMetric {
  label: string;
  value: number;
  unit: string;
  /** Rolling worst value, so a single slow run is visible. */
  max: number;
  samples: number;
}

interface DevMetricsState {
  metrics: Record<string, DevMetric>;
  record: (label: string, value: number, unit?: string) => void;
  reset: () => void;
}

/**
 * Lightweight in-app performance readouts, shown in the Mock API panel. Used
 * to check the explorer's "filter → results within ~100 ms" budget on real
 * hardware without opening DevTools.
 */
export const useDevMetrics = create<DevMetricsState>()((set) => ({
  metrics: {},
  record: (label, value, unit = "ms") =>
    set((state) => {
      const previous = state.metrics[label];
      return {
        metrics: {
          ...state.metrics,
          [label]: {
            label,
            value,
            unit,
            max: Math.max(previous?.max ?? 0, value),
            samples: (previous?.samples ?? 0) + 1,
          },
        },
      };
    }),
  reset: () => set({ metrics: {} }),
}));

export function recordMetric(label: string, value: number, unit?: string) {
  useDevMetrics.getState().record(label, value, unit);
}

/**
 * Runs `fn` and records how long it took. The record is deferred so it's safe
 * to call while rendering (e.g. inside useMemo).
 */
export function timed<T>(label: string, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  const ms = performance.now() - start;
  queueMicrotask(() => recordMetric(label, ms));
  return result;
}
