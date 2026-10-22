"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { useRegisterDevActions, type DevAction } from "@/lib/mock-controls/dev-actions";
import { useRegisterMockEndpoints } from "@/lib/mock-controls/use-register-mock-endpoints";
import { resetDemo } from "../api/client";
import { CART_ENDPOINT_LIST } from "../api/endpoints";
import { useCartEdits } from "../state/cart-edits";
import { useCartSession } from "../state/cart-session";
import { useCheckoutSession } from "../state/checkout-session";
import { CartSkeleton } from "./cart-skeleton";
import { GuestCart } from "./guest-cart";
import { SignedInCart } from "./signed-in-cart";

/** Mock API panel entries and demo actions for every /cart page. */
export function useCartDevTools() {
  useRegisterMockEndpoints(CART_ENDPOINT_LIST);
  const queryClient = useQueryClient();
  const actions = useMemo<DevAction[]>(
    () => [
      {
        id: "cart.reset",
        label: "Reset demo",
        description: "Sign out, restore the original carts and forget all orders.",
        run: async () => {
          await resetDemo();
          useCartSession.getState().reset();
          useCheckoutSession.getState().clear();
          useCartEdits.getState().reset();
          queryClient.clear();
          // A full reload also drops in-memory request state (in-flight saves, pollers)
          window.location.reload();
        },
      },
      {
        id: "cart.sign-out",
        label: "Sign out",
        description: "Back to a signed-out device with an empty cart.",
        run: () => {
          useCartSession.getState().signOut();
          useCheckoutSession.getState().clear();
          queryClient.clear();
        },
      },
    ],
    [queryClient],
  );
  useRegisterDevActions(actions);
}

export function CartPage() {
  useCartDevTools();
  // Sign-in state lives in localStorage: render it only after hydration.
  const hydrated = useIsClient();
  const signedIn = useCartSession((s) => s.signedIn);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1
          tabIndex={-1}
          data-focus-id="cart-heading"
          className="font-heading text-2xl font-bold tracking-tight outline-none sm:text-3xl"
        >
          Your cart
        </h1>
        <p className="text-muted-foreground">
          Services from different providers, grouped into the orders they&apos;ll be booked as.
        </p>
      </div>
      {!hydrated ? <CartSkeleton /> : signedIn ? <SignedInCart /> : <GuestCart />}
    </div>
  );
}
