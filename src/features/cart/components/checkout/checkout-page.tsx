"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { useIsClient } from "@/hooks/use-is-client";
import { useCartSession } from "../../state/cart-session";
import { useCheckoutSession } from "../../state/checkout-session";
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
      ) : session ? (
        <ProgressStep session={session} />
      ) : (
        <ReviewStep />
      )}
    </div>
  );
}
