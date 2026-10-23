"use client";

import { useQuery } from "@tanstack/react-query";
import { SmartphoneIcon, Trash2Icon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { fetchCatalog, fetchGuestSeed } from "../api/client";
import { durationLabel, groupTitle } from "../domain/labels";
import { useCartSession } from "../state/cart-session";
import { focusById } from "../state/focus-after-removal";
import { SignInDialog } from "./sign-in-dialog";

/**
 * Signed out: the cart saved on this device. Checkout needs an account, so
 * the main action is signing in, which merges this cart into the account's.
 */
export function GuestCart() {
  const guestItems = useCartSession((s) => s.guestItems);
  const setGuestItems = useCartSession((s) => s.setGuestItems);
  const removeGuestItem = useCartSession((s) => s.removeGuestItem);
  const catalog = useQuery({
    queryKey: ["catalog"],
    queryFn: ({ signal }) => fetchCatalog(signal),
  });

  // First visit: seed the demo's "what this device added before signing in".
  useEffect(() => {
    if (guestItems === null) void fetchGuestSeed().then(setGuestItems);
  }, [guestItems, setGuestItems]);

  // After a removal, focus the next item, else the previous one, else the cart heading
  const pendingFocus = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    if (focusById(pendingFocus.current) || focusById("cart-heading")) pendingFocus.current = null;
  }, [guestItems]);
  const remove = (productId: string) => {
    const items = guestItems ?? [];
    const i = items.findIndex((item) => item.productId === productId);
    const sibling = items[i + 1] ?? items[i - 1];
    pendingFocus.current = sibling ? `guest-${sibling.productId}` : "cart-heading";
    removeGuestItem(productId);
  };

  const products = new Map(catalog.data?.map((p) => [p.id, p]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <SmartphoneIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold">You&apos;re not signed in</p>
            <p className="text-sm text-muted-foreground">
              This cart is saved on this device. Sign in to check out; we&apos;ll add it to your
              account&apos;s cart and tell you exactly what changed.
            </p>
          </div>
        </div>
        <SignInDialog />
      </div>

      {guestItems === null || catalog.isPending ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : guestItems.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">
          There&apos;s nothing in this device&apos;s cart.
        </p>
      ) : (
        <section aria-labelledby="guest-items" className="rounded-xl border bg-card">
          <h2 id="guest-items" className="border-b p-5 font-heading text-lg font-semibold">
            On this device
          </h2>
          <ul className="divide-y">
            {guestItems.map((item) => {
              const product = products.get(item.productId);
              const option = product?.wellnessOptions.find((o) => o.id === item.wellnessPricingId);
              const unit = option?.price ?? product?.price ?? null;
              return (
                <li key={item.productId} className="flex items-center justify-between gap-4 p-5">
                  <div>
                    <p
                      tabIndex={-1}
                      data-focus-id={`guest-${item.productId}`}
                      className="scroll-mt-24 font-medium outline-none"
                    >
                      {product?.title ?? "Service no longer available"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {product
                        ? `${groupTitle(product.type)} · ${product.providerName} · Qty ${item.quantity}${option ? ` · ${durationLabel(option.durationMinutes)}` : ""}`
                        : "It will be left out when you sign in."}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {product && (
                      <span className="text-sm font-medium tabular-nums">
                        {unit
                          ? formatMoney(unit.times(item.quantity), product.currency)
                          : "Choose duration later"}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${product?.title ?? "item"}`}
                      onClick={() => remove(item.productId)}
                    >
                      <Trash2Icon aria-hidden />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
