"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { announce } from "@/components/app/live-announcer";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { isApiError } from "@/lib/api/errors";
import { fetchOrder, placeOrder } from "../api/client";
import type { GroupEvent } from "../domain/checkout-machine";
import { errorBody } from "../domain/errors";
import {
  syncCheckoutAcrossTabs,
  useCheckoutSession,
  type SessionGroup,
} from "../state/checkout-session";
import { CART_KEY } from "../state/line-sync";

const POLL_MS = 1500;
/** Unknown outcomes are re-asked (same key) at 2 s, 4 s, 8 s… capped here. */
const MAX_RECHECK_MS = 30_000;
const LOCK_NAME = "medex:checkout-runner";

/** Requests and timers this tab owns. Module-level: one runner per tab. */
const inFlight = new Set<string>();
const pollers = new Map<string, number>();
const rechecks = new Map<string, number>();

function dispatch(groupType: string, event: GroupEvent) {
  useCheckoutSession.getState().dispatch(groupType, event);
}

function current(groupType: string): SessionGroup | undefined {
  return useCheckoutSession.getState().session?.groups.find((g) => g.groupType === groupType);
}

/**
 * Only one tab drives the checkout (Web Locks); the others follow its writes
 * through the `storage` event. If the driving tab closes, the lock passes to
 * another open tab. Browsers without Web Locks just run it in every tab,
 * which is still safe because all tabs use the same idempotency keys.
 */
function useIsCheckoutLeader(): boolean {
  // Without Web Locks every tab leads (safe: shared idempotency keys). Not rendered, so no hydration concern.
  const [leader, setLeader] = useState(
    () => typeof navigator !== "undefined" && !("locks" in navigator),
  );
  useEffect(() => {
    if (!("locks" in navigator)) return;
    const abort = new AbortController();
    let release: () => void = () => {};
    navigator.locks
      .request(LOCK_NAME, { signal: abort.signal }, () => {
        setLeader(true);
        return new Promise<void>((resolve) => (release = resolve));
      })
      .catch(() => {}); // aborted on unmount
    return () => {
      abort.abort();
      release();
    };
  }, []);
  return leader;
}

/**
 * Drives the checkout state machine: submits orders one at a time, polls
 * card payments, resumes after a reload, and keeps re-asking about an
 * unknown outcome (with the same key) until it settles. Mounted once for the
 * whole app, so it keeps going wherever the customer navigates.
 */
export function useCheckoutRunner() {
  const queryClient = useQueryClient();
  const session = useCheckoutSession((s) => s.session);
  const online = useOnlineStatus();
  const leader = useIsCheckoutLeader();

  useEffect(() => syncCheckoutAcrossTabs(), []);

  useEffect(() => {
    if (!session || !online || !leader) return;

    for (const group of session.groups) {
      if (group.state.status === "awaiting_payment") {
        poll(queryClient, group.groupType, group.state.orderId);
      }
      if (group.state.status === "unknown") scheduleRecheck(group);
    }

    // One order at a time, in order: the customer reads "placing 2 of 3".
    const submitting = session.groups.find((g) => g.state.status === "submitting");
    if (submitting) {
      void submit(queryClient, submitting);
      return;
    }
    const next = session.groups.find((g) => g.state.status === "queued");
    if (next) dispatch(next.groupType, { type: "submit" }); // the key is already on disk
  }, [session, online, leader, queryClient]);
}

async function submit(queryClient: QueryClient, group: SessionGroup) {
  if (group.state.status !== "submitting") return;
  const { key } = group.state;
  if (inFlight.has(key)) return;
  inFlight.add(key);
  try {
    const order = await placeOrder({
      groupType: group.groupType,
      paymentMethod: group.paymentMethod,
      idempotencyKey: key,
      expectedTotals: group.totals,
      items: group.items.map((i) => ({
        lineId: i.lineId,
        productId: i.productId,
        quantity: i.quantity,
        wellnessPricingId: i.wellnessPricingId,
      })),
    });
    dispatch(group.groupType, {
      type: "created",
      orderId: order.orderId,
      orderStatus: order.status,
      totals: order.totals,
    });
    const after = current(group.groupType);
    if (after?.state.status === "confirmed") {
      announce(
        after.state.outcome === "pay_at_clinic"
          ? `${group.title}: booked. You'll pay at the clinic.`
          : `${group.title}: paid.`,
      );
    }
  } catch (error) {
    const body = errorBody(error);
    const status = isApiError(error) && error.kind === "http" ? (error.status ?? 0) : 0;
    if (status === 402) {
      dispatch(group.groupType, {
        type: "declined",
        reason: body?.message ?? "Your bank declined the card payment.",
      });
      announce(`${group.title}: payment declined. You haven't been charged.`, "assertive");
    } else if (status === 400 || status === 404 || status === 409 || status === 422) {
      // A definitive "this order can't be placed as it is"
      dispatch(group.groupType, {
        type: "conflict",
        reason: body?.message ?? "Something in this order changed.",
      });
      announce(`${group.title}: not placed. Please review your cart.`, "assertive");
    } else {
      // 5xx, 408, 429, timeout, dropped connection: it may or may not have gone through.
      dispatch(group.groupType, {
        type: "unknown",
        reason: isApiError(error) ? error.kind : "unknown",
      });
    }
  } finally {
    inFlight.delete(key);
    // Ordered lines leave the cart (or a failed payment returns them): show the truth
    void queryClient.invalidateQueries({ queryKey: CART_KEY });
  }
}

function poll(queryClient: QueryClient, groupType: string, orderId: string) {
  if (pollers.has(orderId)) return;
  const tick = async (delay: number) => {
    try {
      const order = await fetchOrder(orderId);
      if (order.status !== "pending") {
        pollers.delete(orderId);
        dispatch(groupType, { type: "order_status", orderStatus: order.status });
        void queryClient.invalidateQueries({ queryKey: CART_KEY });
        const title = current(groupType)?.title ?? groupType;
        announce(
          order.status === "paid"
            ? `${title}: payment confirmed.`
            : `${title}: payment failed. You haven't been charged.`,
          order.status === "paid" ? "polite" : "assertive",
        );
        return;
      }
      delay = POLL_MS;
    } catch {
      delay = Math.min(delay * 2, 10_000); // keep asking, more gently
    }
    if (current(groupType)?.state.status !== "awaiting_payment")
      return void pollers.delete(orderId);
    pollers.set(
      orderId,
      window.setTimeout(() => void tick(delay), delay),
    );
  };
  pollers.set(
    orderId,
    window.setTimeout(() => void tick(POLL_MS), POLL_MS),
  );
}

/** Re-ask about an unknown outcome with the same key, backing off, until it settles. */
function scheduleRecheck(group: SessionGroup) {
  if (group.state.status !== "unknown") return;
  const id = `${group.state.key}:${group.state.attempt}`;
  if (rechecks.has(id)) return;
  const delay = Math.min(2000 * 2 ** (group.state.attempt - 1), MAX_RECHECK_MS);
  rechecks.set(
    id,
    window.setTimeout(() => {
      rechecks.delete(id);
      if (current(group.groupType)?.state.status === "unknown") {
        dispatch(group.groupType, { type: "retry" });
      }
    }, delay),
  );
}
