"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * A confirm whose outcome we don't know yet (sent, then the connection
 * dropped). Kept in sessionStorage so a reload still knows, and the same
 * idempotency key is reused when we check, so the server can never make a
 * second booking from it.
 *
 * `scope` is "create:<providerId>" or "move:<bookingId>".
 */
export interface PendingConfirm {
  key: string;
  /** What was sent, so the check re-sends exactly the same thing. */
  request: { specialistId: string; date: string; startTime: string; numberOfPeople: number };
  status: "sending" | "unknown";
  /** It has gone unanswered at least once, so it may already be booked. */
  uncertain: boolean;
  sentAt: number;
}

interface ConfirmAttemptState {
  pending: Record<string, PendingConfirm>;
  begin: (scope: string, request: PendingConfirm["request"]) => PendingConfirm;
  markUnknown: (scope: string) => void;
  settle: (scope: string) => void;
}

const sameRequest = (a: PendingConfirm["request"], b: PendingConfirm["request"]) =>
  a.specialistId === b.specialistId &&
  a.date === b.date &&
  a.startTime === b.startTime &&
  a.numberOfPeople === b.numberOfPeople;

export const useConfirmAttempts = create<ConfirmAttemptState>()(
  persist(
    (set, get) => ({
      pending: {},
      begin: (scope, request) => {
        const previous = get().pending[scope];
        // Re-sending the unresolved request? Same key, so a booking that did go through is returned, not repeated
        const again = previous && sameRequest(previous.request, request) ? previous : null;
        const attempt: PendingConfirm = {
          key: again?.key ?? crypto.randomUUID(),
          request,
          status: "sending",
          uncertain: again ? again.uncertain || again.status === "unknown" : false,
          sentAt: Date.now(),
        };
        set((s) => ({ pending: { ...s.pending, [scope]: attempt } }));
        return attempt;
      },
      markUnknown: (scope) =>
        set((s) => {
          const attempt = s.pending[scope];
          return attempt ? { pending: { ...s.pending, [scope]: { ...attempt, status: "unknown", uncertain: true } } } : s;
        }),
      settle: (scope) =>
        set((s) => {
          const next = { ...s.pending };
          delete next[scope];
          return { pending: next };
        }),
    }),
    {
      name: "medex.booking-attempts",
      storage: createJSONStorage(() => sessionStorage),
      // A reload mid-request can't know how it ended
      merge: (persisted, current) => {
        const pending = (persisted as Partial<ConfirmAttemptState> | undefined)?.pending ?? {};
        return {
          ...current,
          pending: Object.fromEntries(
            Object.entries(pending).map(([k, v]) => [k, { ...v, status: "unknown" as const, uncertain: true }]),
          ),
        };
      },
    },
  ),
);
