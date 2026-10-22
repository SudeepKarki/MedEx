"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { isIanaZone, type Zone } from "../domain/timezone";

/**
 * The customer's own time zone, for the second clock. Detected from the
 * device; changeable (someone in Kathmandu might be planning from abroad).
 */
interface CustomerZoneState {
  /** null = use the device's zone */
  chosen: string | null;
  setChosen: (zone: string | null) => void;
}

export const useCustomerZoneStore = create<CustomerZoneState>()(
  persist((set) => ({ chosen: null, setChosen: (chosen) => set({ chosen }) }), {
    name: "medex.customer-zone",
    storage: createJSONStorage(() => localStorage),
  }),
);

export function deviceZoneId(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function useCustomerZone(hydrated: boolean): { zone: Zone; detected: boolean } {
  const chosen = useCustomerZoneStore((s) => s.chosen);
  // Before hydration there is no device to ask; UTC keeps server and client HTML equal
  if (!hydrated) return { zone: { kind: "iana", id: "UTC" }, detected: true };
  const id = chosen && isIanaZone(chosen) ? chosen : deviceZoneId();
  return { zone: { kind: "iana", id }, detected: !chosen };
}
