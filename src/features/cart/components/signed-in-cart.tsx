"use client";

import { useLayoutEffect } from "react";
import { ErrorState } from "./states";
import { useCart } from "../hooks/use-cart";
import { useCartSession } from "../state/cart-session";
import { focusById, usePendingFocus } from "../state/focus-after-removal";
import { CartGroupCard } from "./cart-group-card";
import { CartSkeleton } from "./cart-skeleton";
import { CartSummary } from "./cart-summary";
import { CheckoutBanner } from "./checkout-banner";
import { EmptyCart } from "./empty-cart";
import { MergeSummary } from "./merge-summary";

export function SignedInCart() {
  const { query, groups } = useCart();
  const mergeChanges = useCartSession((s) => s.mergeChanges);
  const dismissMerge = useCartSession((s) => s.dismissMerge);
  const pendingFocus = usePendingFocus((s) => s.target);
  const setPendingFocus = usePendingFocus((s) => s.set);

  // After an item is removed (optimistically), move focus somewhere sensible.
  useLayoutEffect(() => {
    if (!pendingFocus) return;
    if (focusById(pendingFocus) || focusById("cart-heading")) setPendingFocus(null);
  }, [groups, pendingFocus, setPendingFocus]);

  const orders = groups?.filter((g) => !g.unavailable) ?? [];

  return (
    <div className="flex flex-col gap-6">
      {mergeChanges && <MergeSummary changes={mergeChanges} onDismiss={dismissMerge} />}
      <CheckoutBanner />
      {query.isPending ? (
        <CartSkeleton />
      ) : query.isError && !query.data ? (
        <ErrorState
          error={query.error}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : !groups || groups.length === 0 ? (
        <EmptyCart />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex flex-col gap-4">
            {groups.map((group) => {
              const index = orders.indexOf(group);
              return (
                <CartGroupCard
                  key={group.type}
                  group={group}
                  groups={groups}
                  orderNumber={
                    index >= 0 && orders.length > 1 ? { index: index + 1, of: orders.length } : null
                  }
                />
              );
            })}
          </div>
          <div className="lg:sticky lg:top-20">
            <CartSummary groups={groups} />
          </div>
        </div>
      )}
    </div>
  );
}
