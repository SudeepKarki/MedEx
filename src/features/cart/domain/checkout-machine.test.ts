import { describe, expect, it } from "vitest";
import {
  isPending,
  isSettled,
  transition,
  type GroupCheckout,
  type GroupEvent,
} from "./checkout-machine";

const start = (paymentMethod: GroupCheckout["paymentMethod"] = "card"): GroupCheckout => ({
  groupType: "lab_test",
  paymentMethod,
  state: { status: "queued", key: "k1" },
  rev: 0,
});

const run = (group: GroupCheckout, ...events: GroupEvent[]) => events.reduce(transition, group);

describe("checkout state machine", () => {
  it("card: submitting (with the key minted at start) → awaiting payment → confirmed", () => {
    const g = run(
      start(),
      { type: "submit" },
      { type: "created", orderId: "MX-1", orderStatus: "pending", totals: { THB: 1677 } },
    );
    expect(g.state).toEqual({
      status: "awaiting_payment",
      key: "k1",
      orderId: "MX-1",
      totals: { THB: 1677 },
    });
    expect(run(g, { type: "order_status", orderStatus: "paid" }).state).toEqual({
      status: "confirmed",
      orderId: "MX-1",
      outcome: "paid",
      totals: { THB: 1677 },
    });
  });

  it("pay at clinic: a pending order is a confirmed booking", () => {
    const g = run(
      start("pay_at_clinic"),
      { type: "submit" },
      { type: "created", orderId: "MX-2", orderStatus: "pending" },
    );
    expect(g.state).toMatchObject({
      status: "confirmed",
      orderId: "MX-2",
      outcome: "pay_at_clinic",
    });
  });

  it("an unknown outcome is retried with the SAME key, and isn't treated as finished", () => {
    const unknown = run(start(), { type: "submit" }, { type: "unknown", reason: "timeout" });
    expect(isPending(unknown.state)).toBe(true);
    expect(isSettled(unknown.state)).toBe(false);
    expect(run(unknown, { type: "retry", newKey: "ignored" }).state).toEqual({
      status: "submitting",
      key: "k1",
      attempt: 2,
    });
  });

  it("a decline is retried with a NEW key", () => {
    const declined = run(start(), { type: "submit" }, { type: "declined", reason: "no" });
    expect(declined.state.status).toBe("declined");
    // Without a new key there's nothing safe to do
    expect(transition(declined, { type: "retry" })).toBe(declined);
    const retried = run(declined, { type: "retry", newKey: "k2" }, { type: "submit" });
    expect(retried.state).toEqual({ status: "submitting", key: "k2", attempt: 1 });
  });

  it("a payment that fails after acceptance becomes a decline, keeping the order id", () => {
    const g = run(
      start(),
      { type: "submit" },
      { type: "created", orderId: "MX-3", orderStatus: "pending" },
      { type: "order_status", orderStatus: "failed" },
    );
    expect(g.state).toMatchObject({ status: "declined", orderId: "MX-3" });
  });

  it("a conflict can't be retried as-is (the cart has to be reviewed)", () => {
    const g = run(start(), { type: "submit" }, { type: "conflict", reason: "changed" });
    expect(run(g, { type: "retry", newKey: "k2" }).state.status).toBe("conflict");
  });

  it("ignores events that don't apply (no double submit, no late responses)", () => {
    const submitting = run(start(), { type: "submit" });
    expect(transition(submitting, { type: "submit" })).toBe(submitting);
    const confirmed = run(submitting, { type: "created", orderId: "MX-4", orderStatus: "paid" });
    expect(transition(confirmed, { type: "declined", reason: "late" })).toBe(confirmed);
    expect(transition(confirmed, { type: "retry", newKey: "k9" })).toBe(confirmed);
  });

  it("lets the customer switch payment method after a decline (new key)", () => {
    const declined = run(start(), { type: "submit" }, { type: "declined", reason: "no" });
    const switched = transition(declined, {
      type: "change_payment",
      paymentMethod: "pay_at_clinic",
      newKey: "k2",
    });
    expect(switched).toMatchObject({
      paymentMethod: "pay_at_clinic",
      state: { status: "queued", key: "k2" },
    });
  });

  it("counts every transition, so tabs can tell which state is newer", () => {
    const g = run(start(), { type: "submit" }, { type: "unknown", reason: "x" }, { type: "retry" });
    expect(g.rev).toBe(3);
  });
});
