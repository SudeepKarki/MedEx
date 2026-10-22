"use client";

import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

/**
 * Online status as TanStack Query sees it, so the banner and paused queries
 * always agree. Includes the dev panel's "simulate offline" switch (wired up
 * in <AppProviders>).
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );
}
