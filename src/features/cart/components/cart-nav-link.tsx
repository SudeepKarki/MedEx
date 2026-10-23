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
      className="relative inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-white/90 transition-colors outline-none hover:bg-white/15 hover:text-white focus-visible:ring-3 focus-visible:ring-white/70 pointer-coarse:min-h-11"
    >
      <ShoppingCartIcon aria-hidden className="size-4" />
      Cart
      {count !== null && count > 0 && (
        <span className="min-w-5 rounded-full bg-notify px-1.5 text-center text-xs leading-5 font-bold text-white tabular-nums">
          {count}
          <span className="sr-only"> items</span>
        </span>
      )}
    </Link>
  );
}
