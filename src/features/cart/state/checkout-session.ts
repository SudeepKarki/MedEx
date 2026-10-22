"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  isActive,
  transition,
  type GroupCheckout,
  type GroupEvent,
} from "../domain/checkout-machine";
import type { PaymentMethod } from "../domain/types";

/** What was ordered, frozen at the moment the customer pressed "Place orders". */
export interface SnapshotItem {
  lineId: string;
  productId: string;
  title: string;
  providerName: string;
  quantity: number;
  wellnessPricingId: string | null;
  durationMinutes: number | null;
  currency: string;
  /** Exact decimal string, per unit. */
  unitPrice: string;
}

export interface SessionGroup extends GroupCheckout {
  title: string;
  items: SnapshotItem[];
  /** Per currency, exact decimal strings. */
  totals: Record<string, string>;
}

export interface CheckoutSession {
  id: string;
  createdAt: string;
  groups: SessionGroup[];
}

export interface GroupDraft {
  groupType: string;
  title: string;
  paymentMethod: PaymentMethod;
  items: SnapshotItem[];
  totals: Record<string, string>;
}

interface CheckoutSessionState {
  session: CheckoutSession | null;
  start: (drafts: GroupDraft[]) => void;
  dispatch: (groupType: string, event: GroupEvent) => void;
  clear: () => void;
}

/**
 * The checkout in progress, persisted to localStorage on every transition,
 * synchronously and *before* the matching request is sent. That's what makes
 * a reload (or a closed tab) safe: coming back, the runner finds exactly
 * which orders were placed, which are waiting for payment and which request
 * might still be out there, with the key to ask about it again.
 */
export const useCheckoutSession = create<CheckoutSessionState>()(
  persist(
    (set) => ({
      session: null,
      start: (drafts) =>
        set({
          session: {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            groups: drafts.map((d) => ({ ...d, state: { status: "queued" } })),
          },
        }),
      dispatch: (groupType, event) =>
        set((s) => {
          if (!s.session) return s;
          return {
            session: {
              ...s.session,
              groups: s.session.groups.map((g) =>
                g.groupType === groupType ? { ...g, ...transition(g, event) } : g,
              ),
            },
          };
        }),
      clear: () => set({ session: null }),
    }),
    { name: "medex.checkout", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

/** Group types that must not be edited in the cart right now. */
export function lockedGroupTypes(session: CheckoutSession | null): Set<string> {
  return new Set(session?.groups.filter((g) => isActive(g.state)).map((g) => g.groupType) ?? []);
}
