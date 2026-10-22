import { describe, expect, it } from "vitest";
import { transition, type GroupCheckout, type GroupEvent } from "./checkout-machine";

const start = (paymentMethod: GroupCheckout["paymentMethod"] = "card"): GroupCheckout => ({
  groupType: "lab_test",
  paymentMethod,
  state: { status: "queued" },
});

const run = (group: GroupCheckout, ...events: GroupEvent[]) => events.reduce(transition, group);

describe("checkout state machine", () => {
  it("card: submitting → awaiting payment → confirmed", () => {
    const g = run(
      start(),
      { type: "submit", key: "k1" },
      { type: "created", orderId: "MX-1", orderStatus: "pending" },
    );
    expect(g.state).toEqual({ status: "awaiting_payment", key: "k1", orderId: "MX-1" });
    expect(run(g, { type: "order_status", orderStatus: "paid" }).state).toEqual({
      status: "confirmed",
      orderId: "MX-1",
      outcome: "paid",
    });
  });

  it("pay at clinic: a pending order is a confirmed booking", () => {
    const g = run(
      start("pay_at_clinic"),
      { type: "submit", key: "k1" },
      { type: "created", orderId: "MX-2", orderStatus: "pending" },
    );
    expect(g.state).toEqual({ status: "confirmed", orderId: "MX-2", outcome: "pay_at_clinic" });
  });

  it("an unknown outcome is retried with the SAME key", () => {
    const g = run(
      start(),
      { type: "submit", key: "k1" },
      { type: "unknown", reason: "timeout" },
      { type: "retry" },
    );
    expect(g.state).toEqual({ status: "submitting", key: "k1", attempt: 2 });
  });

  it("a decline is retried with a NEW key (queued, then a fresh submit)", () => {
    const declined = run(
      start(),
      { type: "submit", key: "k1" },
      { type: "declined", reason: "no" },
    );
    expect(declined.state.status).toBe("declined");
    const retried = run(declined, { type: "retry" }, { type: "submit", key: "k2" });
    expect(retried.state).toEqual({ status: "submitting", key: "k2", attempt: 1 });
  });

  it("a payment that fails after acceptance becomes a decline, keeping the order id", () => {
    const g = run(
      start(),
      { type: "submit", key: "k1" },
      { type: "created", orderId: "MX-3", orderStatus: "pending" },
      { type: "order_status", orderStatus: "failed" },
    );
    expect(g.state).toMatchObject({ status: "declined", orderId: "MX-3" });
  });

  it("a conflict can't be retried as-is (the cart has to be reviewed)", () => {
    const g = run(start(), { type: "submit", key: "k1" }, { type: "conflict", reason: "changed" });
    expect(run(g, { type: "retry" }).state.status).toBe("conflict");
  });

  it("ignores events that don't apply (no double submit, no late responses)", () => {
    const submitting = run(start(), { type: "submit", key: "k1" });
    // A second click on "Place order" can't mint another key
    expect(transition(submitting, { type: "submit", key: "k2" })).toBe(submitting);
    // A late response for an already-confirmed order changes nothing
    const confirmed = run(submitting, { type: "created", orderId: "MX-4", orderStatus: "paid" });
    expect(transition(confirmed, { type: "declined", reason: "late" })).toBe(confirmed);
    expect(transition(confirmed, { type: "retry" })).toBe(confirmed);
  });

  it("lets the customer switch payment method after a decline", () => {
    const declined = run(
      start(),
      { type: "submit", key: "k1" },
      { type: "declined", reason: "no" },
    );
    const switched = transition(declined, {
      type: "change_payment",
      paymentMethod: "pay_at_clinic",
    });
    expect(switched).toMatchObject({ paymentMethod: "pay_at_clinic", state: { status: "queued" } });
  });
});
