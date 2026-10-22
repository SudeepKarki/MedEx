"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const MAX_COMPARE = 3;

interface CompareState {
  providerIds: number[];
  toggle: (providerId: number) => void;
  remove: (providerId: number) => void;
  clear: () => void;
}

/**
 * Providers the customer is comparing. A working selection rather than part of
 * the view, so it lives in a session-scoped store instead of the URL: it
 * survives reloads and filter changes but doesn't clutter shared links.
 */
export const useCompare = create<CompareState>()(
  persist(
    (set) => ({
      providerIds: [],
      toggle: (id) =>
        set((s) =>
          s.providerIds.includes(id)
            ? { providerIds: s.providerIds.filter((p) => p !== id) }
            : s.providerIds.length >= MAX_COMPARE
              ? s
              : { providerIds: [...s.providerIds, id] },
        ),
      remove: (id) => set((s) => ({ providerIds: s.providerIds.filter((p) => p !== id) })),
      clear: () => set({ providerIds: [] }),
    }),
    { name: "medex.compare", storage: createJSONStorage(() => sessionStorage) },
  ),
);
