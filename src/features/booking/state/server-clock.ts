"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { toWallClock, type Zone } from "../domain/timezone";
import type { ProviderNow } from "../domain/availability";

/**
 * How far the device clock is from the server's. "Has this slot already
 * started?" must be answered by the clock at the provider, so it uses the
 * server's time (sent with every response), not the device's, which may be
 * wrong or in another zone.
 */
const useServerOffset = create<{ offsetMs: number; known: boolean }>()(() => ({ offsetMs: 0, known: false }));

export function noteServerTime(iso: string) {
  const server = Date.parse(iso);
  if (Number.isFinite(server)) useServerOffset.setState({ offsetMs: server - Date.now(), known: true });
}

export function serverNow(): number {
  return Date.now() + useServerOffset.getState().offsetMs;
}

// One shared minute ticker, so "started" updates while the page is open
const listeners = new Set<() => void>();
let minute = Math.floor(Date.now() / 60_000);
let timer: number | undefined;
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = window.setInterval(() => {
      const next = Math.floor(serverNow() / 60_000);
      if (next !== minute) {
        minute = next;
        listeners.forEach((l) => l());
      }
    }, 5_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.clearInterval(timer);
  };
}

/** The current minute on the server's clock, re-rendering when it ticks over. */
export function useServerMinute(): number {
  const offset = useServerOffset((s) => s.offsetMs);
  return useSyncExternalStore(
    subscribe,
    () => Math.floor((Date.now() + offset) / 60_000),
    () => 0,
  );
}

/** Now, on the provider's clock. */
export function providerNowFrom(zone: Zone, minuteStamp: number): ProviderNow {
  const wall = toWallClock(zone, minuteStamp * 60_000);
  return { today: wall.date, minutes: wall.minutes };
}
