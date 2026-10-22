import type { Metadata } from "next";
import { Suspense } from "react";
import { CartSkeleton } from "@/features/cart/components/cart-skeleton";
import { CheckoutPage } from "@/features/cart/components/checkout/checkout-page";

export const metadata: Metadata = { title: "Checkout" };

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
          <CartSkeleton />
        </div>
      }
    >
      <CheckoutPage />
    </Suspense>
  );
}
