"use client";

import { useQuery } from "@tanstack/react-query";
import { ShoppingCartIcon } from "lucide-react";
import Link from "next/link";
import { useIsClient } from "@/hooks/use-is-client";
import { useCartSession } from "../state/cart-session";
import { cartQueryOptions } from "../state/line-sync";

/** Header link with the number of items in the cart (account or device). */
export function CartNavLink() {
  const hydrated = useIsClient();
  const signedIn = useCartSession((s) => s.signedIn);
  const guestItems = useCartSession((s) => s.guestItems);
  const cart = useQuery({ ...cartQueryOptions, enabled: hydrated && signedIn });
  const count = !hydrated
    ? null
    : signedIn
      ? (cart.data?.lines.reduce((n, l) => n + l.quantity, 0) ?? null)
      : (guestItems?.reduce((n, i) => n + i.quantity, 0) ?? null);

  return (
    <Link
      href="/cart"
      className="relative inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <ShoppingCartIcon aria-hidden className="size-4" />
      Cart
      {count !== null && count > 0 && (
        <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
          {count}
          <span className="sr-only"> items</span>
        </span>
      )}
    </Link>
  );
}
