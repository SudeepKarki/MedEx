"use client";

import { ArrowRightIcon, ReceiptIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { isActive } from "../domain/checkout-machine";
import { useCheckoutSession } from "../state/checkout-session";

/** On the cart page while a checkout is running (or finished but not reviewed). */
export function CheckoutBanner() {
  const session = useCheckoutSession((s) => s.session);
  if (!session) return null;
  const active = session.groups.some((g) => isActive(g.state));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-accent/60 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <ReceiptIcon aria-hidden className="size-5 text-primary" />
        {active
          ? "Your checkout is still in progress. Those items are locked until it finishes."
          : "Your last checkout has finished. See what happened to each order."}
      </p>
      <Link href="/cart/checkout" className={buttonVariants({ variant: "outline" })}>
        View checkout
        <ArrowRightIcon aria-hidden />
      </Link>
    </div>
  );
}
