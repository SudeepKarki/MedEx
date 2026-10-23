import type { Metadata } from "next";
import { Suspense } from "react";
import { CartSkeleton } from "@/features/cart/components/cart-skeleton";
import { CheckoutPage } from "@/features/cart/components/checkout/checkout-page";

export const metadata: Metadata = { title: "Checkout" };

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="page-container py-6 *:max-w-4xl lg:py-8">
          <CartSkeleton />
        </div>
      }
    >
      <CheckoutPage />
    </Suspense>
  );
}
