"use client";

import { create } from "zustand";

type Politeness = "polite" | "assertive";

interface AnnouncerState {
  polite: string;
  assertive: string;
  announce: (message: string, politeness?: Politeness) => void;
}

/**
 * One app-wide pair of live regions. Regions must exist in the DOM *before*
 * their text changes or screen readers ignore them, so they're rendered once in
 * the root layout and components call `announce()` instead of rendering their own.
 */
export const useAnnouncer = create<AnnouncerState>()((set) => ({
  polite: "",
  assertive: "",
  announce: (message, politeness = "polite") => {
    // Clear first so repeating the same sentence is still announced.
    set({ [politeness]: "" } as Pick<AnnouncerState, Politeness>);
    window.setTimeout(() => set({ [politeness]: message } as Pick<AnnouncerState, Politeness>), 50);
  },
}));

export function announce(message: string, politeness?: Politeness) {
  useAnnouncer.getState().announce(message, politeness);
}

export function LiveAnnouncer() {
  const polite = useAnnouncer((s) => s.polite);
  const assertive = useAnnouncer((s) => s.assertive);
  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {polite}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertive}
      </div>
    </>
  );
}
