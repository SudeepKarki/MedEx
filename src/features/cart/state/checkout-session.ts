"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  isPending,
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
  /** What the customer saw, per currency, exact decimal strings. Sent so the server can refuse a price change. */
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

export const CHECKOUT_STORAGE_KEY = "medex.checkout";

/**
 * Two tabs may both hold the session. When one of them writes, keep the newer
 * state of each order (higher `rev`), so neither tab can roll the other back.
 */
function mergeSessions(persisted: CheckoutSession | null, current: CheckoutSession | null) {
  if (!persisted || !current || persisted.id !== current.id) return persisted;
  return {
    ...current,
    groups: current.groups.map((mine) => {
      const theirs = persisted.groups.find((g) => g.groupType === mine.groupType);
      return theirs && theirs.rev > mine.rev ? theirs : mine;
    }),
  };
}

/**
 * The checkout in progress, persisted to localStorage on every transition,
 * synchronously and *before* the matching request is sent. That's what makes
 * a reload (or a closed tab) safe: coming back, the runner finds exactly
 * which orders were placed, which are waiting for payment and which request
 * might still be out there, with the key to ask about it again.
 *
 * Every order's idempotency key is minted here, at the start, so all tabs
 * that load the session use the same keys.
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
            groups: drafts.map((d) => ({
              ...d,
              state: { status: "queued", key: crypto.randomUUID() },
              rev: 0,
            })),
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
    {
      name: CHECKOUT_STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => ({
        ...current,
        session: mergeSessions(
          (persisted as Partial<CheckoutSessionState> | undefined)?.session ?? null,
          current.session,
        ),
      }),
    },
  ),
);

/** Group types that must not be edited in the cart right now (including unconfirmed ones). */
export function lockedGroupTypes(session: CheckoutSession | null): Set<string> {
  return new Set(session?.groups.filter((g) => isPending(g.state)).map((g) => g.groupType) ?? []);
}

export function hasPendingCheckout(session: CheckoutSession | null): boolean {
  return Boolean(session?.groups.some((g) => isPending(g.state)));
}

/** Follow writes made by other tabs (the `storage` event only fires in the *other* tabs). */
export function syncCheckoutAcrossTabs(): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === CHECKOUT_STORAGE_KEY) void useCheckoutSession.persist.rehydrate();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
