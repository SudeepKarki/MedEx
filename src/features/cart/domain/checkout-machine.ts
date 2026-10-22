import type { PaymentMethod } from "./types";

/**
 * Checkout, one state machine per order (per cart group).
 *
 *   queued(key) ──submit──▶ submitting ──201 card, pending──▶ awaiting_payment ──paid──▶ confirmed
 *                              │ ├──201 paid / pay at clinic─────────────────────────────▶ confirmed
 *                              │ ├──402 declined──▶ declined ──retry(NEW key)──▶ queued
 *                              │ ├──409 conflict──▶ conflict   (review the cart; no retry)
 *                              │ └──5xx/network/timeout/offline──▶ unknown ──retry(SAME key)──▶ submitting
 *   awaiting_payment ──failed──▶ declined
 *
 * Every order gets its idempotency key when the checkout starts, so the key
 * is on disk before any request and every tab uses the same one. Whenever the
 * outcome is unknown, the same key is sent again, so the server either
 * returns the order it already made or makes it now, never twice. Only a
 * definitive "no" (declined) moves to a fresh key, because the old one would
 * just replay that "no".
 *
 * `unknown` is not an outcome: the order may well exist. It stays pending
 * (cart lines locked, no "Done") until a retry with the same key settles it.
 */
export type GroupState =
  | { status: "queued"; key: string }
  | { status: "submitting"; key: string; attempt: number }
  | { status: "awaiting_payment"; key: string; orderId: string; totals: ServerTotals | null }
  | {
      status: "confirmed";
      orderId: string;
      outcome: "paid" | "pay_at_clinic";
      totals: ServerTotals | null;
    }
  | { status: "declined"; reason: string; orderId: string | null }
  | { status: "conflict"; reason: string }
  | { status: "unknown"; key: string; attempt: number; reason: string };

/** What the server says the order costs, per currency. */
export type ServerTotals = Record<string, number>;

export type GroupEvent =
  | { type: "submit" }
  | {
      type: "created";
      orderId: string;
      orderStatus: "pending" | "paid" | "failed";
      totals?: ServerTotals;
    }
  | { type: "declined"; reason: string }
  | { type: "conflict"; reason: string }
  | { type: "unknown"; reason: string }
  | { type: "order_status"; orderStatus: "pending" | "paid" | "failed"; reason?: string }
  /** From `unknown`: ask again with the same key. From `declined`: start over with `newKey`. */
  | { type: "retry"; newKey?: string }
  | { type: "change_payment"; paymentMethod: PaymentMethod; newKey: string };

export interface GroupCheckout {
  groupType: string;
  paymentMethod: PaymentMethod;
  state: GroupState;
  /** Bumped on every transition; lets two tabs agree on the newest state. */
  rev: number;
}

/** Pure transition. Events that don't apply in the current state are ignored (same object back). */
export function transition(group: GroupCheckout, event: GroupEvent): GroupCheckout {
  const { state } = group;
  const to = (next: GroupState, patch: Partial<GroupCheckout> = {}): GroupCheckout => ({
    ...group,
    ...patch,
    state: next,
    rev: group.rev + 1,
  });

  switch (event.type) {
    case "submit":
      return state.status === "queued"
        ? to({ status: "submitting", key: state.key, attempt: 1 })
        : group;

    case "created": {
      if (state.status !== "submitting") return group;
      const totals = event.totals ?? null;
      if (event.orderStatus === "paid") {
        return to({ status: "confirmed", orderId: event.orderId, outcome: "paid", totals });
      }
      if (event.orderStatus === "failed") {
        return to({
          status: "declined",
          orderId: event.orderId,
          reason: "The payment didn't go through.",
        });
      }
      return group.paymentMethod === "pay_at_clinic"
        ? to({ status: "confirmed", orderId: event.orderId, outcome: "pay_at_clinic", totals })
        : to({ status: "awaiting_payment", key: state.key, orderId: event.orderId, totals });
    }

    case "declined":
      return state.status === "submitting"
        ? to({ status: "declined", reason: event.reason, orderId: null })
        : group;

    case "conflict":
      return state.status === "submitting"
        ? to({ status: "conflict", reason: event.reason })
        : group;

    case "unknown":
      return state.status === "submitting"
        ? to({ status: "unknown", key: state.key, attempt: state.attempt, reason: event.reason })
        : group;

    case "order_status":
      if (state.status !== "awaiting_payment") return group;
      if (event.orderStatus === "paid") {
        return to({
          status: "confirmed",
          orderId: state.orderId,
          outcome: "paid",
          totals: state.totals,
        });
      }
      if (event.orderStatus === "failed") {
        return to({
          status: "declined",
          orderId: state.orderId,
          reason: event.reason ?? "Your bank didn't approve the payment.",
        });
      }
      return group;

    case "retry":
      if (state.status === "unknown") {
        return to({ status: "submitting", key: state.key, attempt: state.attempt + 1 });
      }
      return state.status === "declined" && event.newKey
        ? to({ status: "queued", key: event.newKey })
        : group;

    case "change_payment":
      // A queued order hasn't been sent, so its key can stay; a declined one needs a new key.
      if (state.status === "queued") {
        return to({ status: "queued", key: state.key }, { paymentMethod: event.paymentMethod });
      }
      return state.status === "declined"
        ? to({ status: "queued", key: event.newKey }, { paymentMethod: event.paymentMethod })
        : group;
  }
}

/** Finished: the customer can be told the outcome and leave. */
export const isSettled = (s: GroupState) =>
  s.status === "confirmed" || s.status === "declined" || s.status === "conflict";

/**
 * Not finished, including `unknown` (the order may exist). Its cart lines
 * stay locked and the checkout can't be dismissed.
 */
export const isPending = (s: GroupState) => !isSettled(s);

/** Definitively not placed and can be tried again (with a new key). */
export const canTryAgain = (s: GroupState) => s.status === "declined";
