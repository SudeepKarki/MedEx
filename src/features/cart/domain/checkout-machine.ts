import type { PaymentMethod } from "./types";

/**
 * Checkout, one state machine per order (per cart group).
 *
 *   queued ──submit(key)──▶ submitting ──201 card, pending──▶ awaiting_payment ──paid──▶ confirmed
 *                              │ ├──201 paid / pay at clinic─────────────────────────────▶ confirmed
 *                              │ ├──402 declined──▶ declined ──retry (NEW key)──▶ queued
 *                              │ ├──409 conflict──▶ conflict   (review the cart; no retry)
 *                              │ └──5xx/network/timeout/offline──▶ unknown ──retry (SAME key)──▶ submitting
 *   awaiting_payment ──failed──▶ declined
 *
 * The idempotency key is minted on `submit` and stored in the state, which is
 * persisted *before* the request is sent. Whenever the outcome is unknown, the
 * same key is sent again, so the server either returns the order it already
 * made or makes it now, never twice. Only a definitive "no" (declined) gets a
 * fresh key, because the old one would just replay that "no".
 */
export type GroupState =
  | { status: "queued" }
  | { status: "submitting"; key: string; attempt: number }
  | { status: "awaiting_payment"; key: string; orderId: string }
  | { status: "confirmed"; orderId: string; outcome: "paid" | "pay_at_clinic" }
  | { status: "declined"; reason: string; orderId: string | null }
  | { status: "conflict"; reason: string }
  | { status: "unknown"; key: string; attempt: number; reason: string };

export type GroupEvent =
  | { type: "submit"; key: string }
  | { type: "created"; orderId: string; orderStatus: "pending" | "paid" | "failed" }
  | { type: "declined"; reason: string }
  | { type: "conflict"; reason: string }
  | { type: "unknown"; reason: string }
  | { type: "order_status"; orderStatus: "pending" | "paid" | "failed"; reason?: string }
  | { type: "retry" }
  | { type: "change_payment"; paymentMethod: PaymentMethod };

export interface GroupCheckout {
  groupType: string;
  paymentMethod: PaymentMethod;
  state: GroupState;
}

/** Pure transition. Events that don't apply in the current state are ignored. */
export function transition(group: GroupCheckout, event: GroupEvent): GroupCheckout {
  const { state } = group;
  const to = (next: GroupState): GroupCheckout => ({ ...group, state: next });

  switch (event.type) {
    case "submit":
      return state.status === "queued"
        ? to({ status: "submitting", key: event.key, attempt: 1 })
        : group;

    case "created":
      if (state.status !== "submitting") return group;
      if (event.orderStatus === "paid")
        return to({ status: "confirmed", orderId: event.orderId, outcome: "paid" });
      if (event.orderStatus === "failed") {
        return to({
          status: "declined",
          orderId: event.orderId,
          reason: "The payment didn't go through.",
        });
      }
      return group.paymentMethod === "pay_at_clinic"
        ? to({ status: "confirmed", orderId: event.orderId, outcome: "pay_at_clinic" })
        : to({ status: "awaiting_payment", key: state.key, orderId: event.orderId });

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
      if (event.orderStatus === "paid")
        return to({ status: "confirmed", orderId: state.orderId, outcome: "paid" });
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
      return state.status === "declined" ? to({ status: "queued" }) : group;

    case "change_payment":
      return state.status === "queued" || state.status === "declined"
        ? { ...group, paymentMethod: event.paymentMethod, state: { status: "queued" } }
        : group;
  }
}

export const isTerminal = (s: GroupState) =>
  s.status === "confirmed" || s.status === "declined" || s.status === "conflict";

/** Still needs the runner (or the customer, for `unknown`) to do something. */
export const isActive = (s: GroupState) =>
  s.status === "queued" || s.status === "submitting" || s.status === "awaiting_payment";

/** Failed in a way the customer can retry from the results screen. */
export const isRetryable = (s: GroupState) => s.status === "declined" || s.status === "unknown";

/** Money may have left (or be about to leave) the customer's account. */
export const mayBeCharged = (s: GroupState) =>
  s.status === "awaiting_payment" || (s.status === "confirmed" && s.outcome === "paid");
