"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { buttonVariants } from "@/components/ui/button";
import { useIsClient } from "@/hooks/use-is-client";
import { useCartSession } from "../../state/cart-session";
import { hasPendingCheckout, useCheckoutSession } from "../../state/checkout-session";
import { useCartDevTools } from "../cart-page";
import { CartSkeleton } from "../cart-skeleton";
import { ProgressStep } from "./progress-step";
import { ReviewStep } from "./review-step";

/**
 * /cart/checkout. With a checkout session in storage it shows its progress
 * (also after a reload); otherwise it's the review step for the requested
 * groups.
 */
export function CheckoutPage() {
  useCartDevTools();
  const hydrated = useIsClient();
  const signedIn = useCartSession((s) => s.signedIn);
  const session = useCheckoutSession((s) => s.session);
  const clear = useCheckoutSession((s) => s.clear);
  const requested = useSearchParams().get("groups");
  // A finished checkout is replaced when the customer starts a new one ("Check
  // out lab tests only"); without ?groups (the "View checkout" link) it's shown.
  const startingNew = Boolean(hydrated && requested && session && !hasPendingCheckout(session));
  useEffect(() => {
    if (startingNew) clear();
  }, [startingNew, clear]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      {!hydrated ? (
        <CartSkeleton />
      ) : !signedIn ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center">
          <h1 className="font-heading text-xl font-semibold">Sign in to check out</h1>
          <Link href="/cart" className={buttonVariants({ variant: "outline", className: "mt-4" })}>
            <ArrowLeftIcon aria-hidden /> Back to cart
          </Link>
        </div>
      ) : session && !startingNew ? (
        <ProgressStep session={session} />
      ) : (
        <ReviewStep />
      )}
    </div>
  );
}
