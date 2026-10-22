"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { GuestItem, MergeChange } from "../api/schemas";

/**
 * Demo sign-in state and the guest's on-device cart. The guest cart lives
 * here (localStorage), exactly like a real logged-out cart would; it's only
 * cleared once the merge has succeeded, so a failed sign-in loses nothing.
 */
interface CartSessionState {
  signedIn: boolean;
  /** null until seeded with the demo's guest cart on first visit. */
  guestItems: GuestItem[] | null;
  /** What the last merge changed, until the customer dismisses it. */
  mergeChanges: MergeChange[] | null;

  setGuestItems: (items: GuestItem[]) => void;
  removeGuestItem: (productId: string) => void;
  completeSignIn: (changes: MergeChange[]) => void;
  dismissMerge: () => void;
  signOut: () => void;
  reset: () => void;
}

export const useCartSession = create<CartSessionState>()(
  persist(
    (set) => ({
      signedIn: false,
      guestItems: null,
      mergeChanges: null,

      setGuestItems: (guestItems) => set({ guestItems }),
      removeGuestItem: (productId) =>
        set((s) => ({ guestItems: (s.guestItems ?? []).filter((i) => i.productId !== productId) })),
      completeSignIn: (changes) => set({ signedIn: true, guestItems: [], mergeChanges: changes }),
      dismissMerge: () => set({ mergeChanges: null }),
      signOut: () => set({ signedIn: false, guestItems: [], mergeChanges: null }),
      reset: () => set({ signedIn: false, guestItems: null, mergeChanges: null }),
    }),
    { name: "medex.cart-session", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);
