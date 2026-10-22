"use client";

import { ArrowLeftIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { isActive, isRetryable } from "../../domain/checkout-machine";
import { useCheckoutSession, type CheckoutSession } from "../../state/checkout-session";
import { OrderStatusCard } from "./order-status-card";
import { CheckoutSteps } from "./steps";

function headline(session: CheckoutSession, active: boolean): string {
  const total = session.groups.length;
  const placed = session.groups.filter((g) => g.state.status === "confirmed").length;
  if (active) return total === 1 ? "Placing your order" : "Placing your orders";
  if (placed === total)
    return total === 1 ? "Your order is placed" : `All ${total} orders are placed`;
  if (placed === 0)
    return total === 1 ? "Your order wasn't placed" : "None of your orders were placed";
  return `${placed} of ${total} orders placed`;
}

/**
 * Steps 2 and 3: what's happening to each order, live, then the outcome.
 * Everything here is driven by the persisted session, so a reload lands on
 * exactly the same picture. Focus moves to the heading when the step changes.
 */
export function ProgressStep({ session }: { session: CheckoutSession }) {
  const router = useRouter();
  const clear = useCheckoutSession((s) => s.clear);
  const dispatch = useCheckoutSession((s) => s.dispatch);
  const active = session.groups.some((g) => isActive(g.state));
  const retryable = session.groups.filter((g) => isRetryable(g.state));
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => headingRef.current?.focus(), [active]);

  return (
    <div className="flex flex-col gap-6">
      <CheckoutSteps current={active ? 1 : 2} />
      <div className="flex flex-col gap-2">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-heading text-2xl font-bold tracking-tight outline-none sm:text-3xl"
        >
          {headline(session, active)}
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          {active
            ? "You can keep this page open or leave it. If you close it, we'll pick up where we left off when you come back, and nothing will be charged twice."
            : "Here's exactly what happened to each order."}
        </p>
      </div>

      <ol className="flex flex-col gap-4" aria-label="Orders">
        {session.groups.map((group, i) => (
          <li key={group.groupType}>
            <OrderStatusCard group={group} index={i + 1} of={session.groups.length} />
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Link href="/cart" className={buttonVariants({ variant: "ghost" })}>
          <ArrowLeftIcon aria-hidden /> Back to cart
        </Link>
        <div className="flex flex-wrap gap-2">
          {!active && retryable.length > 1 && (
            <Button
              variant="outline"
              onClick={() => retryable.forEach((g) => dispatch(g.groupType, { type: "retry" }))}
            >
              <RefreshCwIcon aria-hidden />
              Try the {retryable.length} failed orders again
            </Button>
          )}
          {!active && (
            <Button
              onClick={() => {
                clear();
                router.push("/cart");
              }}
            >
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
