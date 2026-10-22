"use client";

import type { QueryClient } from "@tanstack/react-query";
import { announce } from "@/components/app/live-announcer";
import { deleteLine, patchDuration, patchQuantity } from "../api/client";
import { describeCartError, errorBody } from "../domain/errors";
import type { Cart } from "../domain/types";
import { useCartEdits } from "./cart-edits";

export const CART_KEY = ["cart"] as const;

/**
 * Puts a server cart into the cache unless we already hold a newer one.
 * Responses can arrive out of order (two lines saving at once, a refetch
 * racing a PATCH); the revision makes "newest wins" a comparison, not luck.
 */
export function applyServerCart(queryClient: QueryClient, cart: Cart) {
  queryClient.setQueryData<Cart>(CART_KEY, (current) =>
    !current || cart.revision >= current.revision ? cart : current,
  );
}

const running = new Map<string, Promise<void>>();

export function changeQuantity(queryClient: QueryClient, lineId: string, quantity: number) {
  useCartEdits.getState().setEdit(lineId, { quantity });
  void syncLine(queryClient, lineId);
}

export function chooseDuration(
  queryClient: QueryClient,
  lineId: string,
  wellnessPricingId: string,
) {
  useCartEdits.getState().setEdit(lineId, { wellnessPricingId });
  void syncLine(queryClient, lineId);
}

export function removeLine(queryClient: QueryClient, lineId: string) {
  useCartEdits.getState().setEdit(lineId, { removing: true });
  void syncLine(queryClient, lineId);
}

/**
 * Saves one line's edits, one request at a time.
 *
 * The screen updates instantly (the edit is shown); this loop then sends the
 * *latest* wanted value. If the customer taps "+" five times while a request
 * is in flight, those taps just update the wanted value; when the request
 * returns, one more request sends the final quantity. Requests for a line
 * never overlap, so they can't arrive out of order and overwrite each other,
 * and nothing on screen jumps back to an intermediate value.
 */
export function syncLine(queryClient: QueryClient, lineId: string): Promise<void> {
  const existing = running.get(lineId);
  if (existing) return existing; // the running loop will pick up the newest edit

  const store = useCartEdits.getState;
  const loop = (async () => {
    store().setSaving(lineId, true);
    try {
      for (;;) {
        const edit = store().edits[lineId];
        const server = queryClient.getQueryData<Cart>(CART_KEY)?.lines.find((l) => l.id === lineId);
        if (!edit) break;
        if (!server) {
          store().clearEdit(lineId); // gone already (removed elsewhere, or ordered)
          break;
        }

        if (edit.removing) {
          try {
            await deleteLine(lineId);
            queryClient.setQueryData<Cart>(CART_KEY, (c) =>
              c ? { ...c, lines: c.lines.filter((l) => l.id !== lineId) } : c,
            );
            store().clearEdit(lineId);
            void queryClient.invalidateQueries({ queryKey: CART_KEY });
          } catch (error) {
            const message = describeCartError(error, "We couldn't remove this item.");
            store().fail(lineId, "removing", `${message} It's still in your cart.`);
            announce(
              `Couldn't remove ${server.product?.title ?? "the item"}. ${message}`,
              "assertive",
            );
          }
          break;
        }

        if (
          edit.wellnessPricingId !== undefined &&
          edit.wellnessPricingId !== server.wellnessPricingId
        ) {
          const sent = edit.wellnessPricingId;
          try {
            applyServerCart(queryClient, await patchDuration(lineId, sent));
            store().settle(lineId, "wellnessPricingId", sent);
          } catch (error) {
            const message = describeCartError(error, "We couldn't save the duration.");
            store().fail(lineId, "wellnessPricingId", message);
            announce(message, "assertive");
            break;
          }
          continue;
        }

        if (edit.quantity !== undefined && edit.quantity !== server.quantity) {
          const sent = edit.quantity;
          try {
            applyServerCart(queryClient, await patchQuantity(lineId, sent));
            store().settle(lineId, "quantity", sent);
          } catch (error) {
            const max = errorBody(error)?.maxQuantity;
            if (max) store().setMax(lineId, max);
            // Asked for more than the limit (taps are coalesced, so this can be
            // well past it): settle on the limit rather than snapping back.
            if (max && sent > max && store().edits[lineId]?.quantity === sent) {
              const message = `${describeCartError(error, "")} We've set it to ${max}.`;
              store().setEdit(lineId, { quantity: max });
              useCartEdits.setState((s) => ({ errors: { ...s.errors, [lineId]: message } }));
              announce(message, "assertive");
              continue;
            }
            const confirmed =
              queryClient.getQueryData<Cart>(CART_KEY)?.lines.find((l) => l.id === lineId)
                ?.quantity ?? server.quantity;
            const message = `${describeCartError(error, "We couldn't save the new quantity.")} Quantity is back to ${confirmed}.`;
            store().fail(lineId, "quantity", message);
            announce(message, "assertive");
            break;
          }
          continue;
        }

        store().clearEdit(lineId); // what's on screen is what the server has
        break;
      }
    } finally {
      store().setSaving(lineId, false);
      running.delete(lineId);
    }
  })();
  running.set(lineId, loop);
  return loop;
}
