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
  /** Key for the sign-in merge in progress; reused if it's retried, cleared on success. */
  mergeKey: string | null;

  setGuestItems: (items: GuestItem[]) => void;
  /** The current merge attempt's key (made once, kept until the merge succeeds). */
  ensureMergeKey: () => string;
  removeGuestItem: (productId: string) => void;
  completeSignIn: (changes: MergeChange[]) => void;
  dismissMerge: () => void;
  signOut: () => void;
  reset: () => void;
}

export const useCartSession = create<CartSessionState>()(
  persist(
    (set, get) => ({
      signedIn: false,
      guestItems: null,
      mergeChanges: null,
      mergeKey: null,

      setGuestItems: (guestItems) => set({ guestItems }),
      ensureMergeKey: () => {
        const existing = get().mergeKey;
        if (existing) return existing;
        const key = crypto.randomUUID();
        set({ mergeKey: key });
        return key;
      },
      removeGuestItem: (productId) =>
        set((s) => ({ guestItems: (s.guestItems ?? []).filter((i) => i.productId !== productId) })),
      completeSignIn: (changes) =>
        set({ signedIn: true, guestItems: [], mergeChanges: changes, mergeKey: null }),
      dismissMerge: () => set({ mergeChanges: null }),
      signOut: () => set({ signedIn: false, guestItems: [], mergeChanges: null, mergeKey: null }),
      reset: () => set({ signedIn: false, guestItems: null, mergeChanges: null, mergeKey: null }),
    }),
    { name: "medex.cart-session", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);
