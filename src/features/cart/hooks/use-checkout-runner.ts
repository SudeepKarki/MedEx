"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { announce } from "@/components/app/live-announcer";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { isApiError } from "@/lib/api/errors";
import { fetchOrder, placeOrder } from "../api/client";
import { errorBody } from "../domain/errors";
import { CART_KEY } from "../state/line-sync";
import { useCheckoutSession, type SessionGroup } from "../state/checkout-session";

const POLL_MS = 1500;
const AUTO_RETRY_MS = 2000;

/** Requests and timers this tab owns. Module-level: one runner per tab. */
const inFlight = new Set<string>();
const pollers = new Map<string, number>();
const autoRetries = new Set<string>();

function dispatch(
  groupType: string,
  event: Parameters<ReturnType<typeof useCheckoutSession.getState>["dispatch"]>[1],
) {
  useCheckoutSession.getState().dispatch(groupType, event);
}

function current(groupType: string): SessionGroup | undefined {
  return useCheckoutSession.getState().session?.groups.find((g) => g.groupType === groupType);
}

/**
 * Drives the checkout state machine: submits orders one at a time, polls
 * card payments, resumes after a reload, and retries an unknown outcome once
 * automatically (with the same idempotency key). Mounted once for all /cart
 * pages, so polling continues if the customer goes back to the cart.
 */
export function useCheckoutRunner() {
  const queryClient = useQueryClient();
  const session = useCheckoutSession((s) => s.session);
  const online = useOnlineStatus();

  useEffect(() => {
    if (!session || !online) return;

    for (const group of session.groups) {
      if (group.state.status === "awaiting_payment") {
        poll(queryClient, group.groupType, group.state.orderId);
      }
      if (group.state.status === "unknown" && group.state.attempt === 1) scheduleAutoRetry(group);
    }

    // One order at a time, in order: the customer reads "placing 2 of 3".
    const submitting = session.groups.find((g) => g.state.status === "submitting");
    if (submitting) {
      void submit(queryClient, submitting);
      return;
    }
    const next = session.groups.find((g) => g.state.status === "queued");
    // Minting the key is a persisted transition; the request goes out on the
    // next run of this effect, after the key is safely in storage.
    if (next) dispatch(next.groupType, { type: "submit", key: crypto.randomUUID() });
  }, [session, online, queryClient]);
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
    });
    void queryClient.invalidateQueries({ queryKey: CART_KEY });
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
    if (isApiError(error) && error.kind === "http" && error.status === 402) {
      dispatch(group.groupType, {
        type: "declined",
        reason: body?.message ?? "Your bank declined the card payment.",
      });
      announce(`${group.title}: payment declined. You haven't been charged.`, "assertive");
    } else if (isApiError(error) && error.kind === "http" && (error.status ?? 0) < 500) {
      dispatch(group.groupType, {
        type: "conflict",
        reason: body?.message ?? "Something in this order changed.",
      });
      announce(`${group.title}: not placed. Please review your cart.`, "assertive");
    } else {
      // 5xx, timeout, dropped connection: we don't know if it went through.
      dispatch(group.groupType, {
        type: "unknown",
        reason: isApiError(error) ? error.kind : "unknown",
      });
    }
  } finally {
    inFlight.delete(key);
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

function scheduleAutoRetry(group: SessionGroup) {
  if (group.state.status !== "unknown" || autoRetries.has(group.state.key)) return;
  autoRetries.add(group.state.key);
  window.setTimeout(() => {
    // Same key: if the first attempt did reach the server, this returns that order.
    if (current(group.groupType)?.state.status === "unknown") {
      dispatch(group.groupType, { type: "retry" });
    }
  }, AUTO_RETRY_MS);
}
