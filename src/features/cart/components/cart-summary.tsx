import { ArrowRightIcon, InfoIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { itemsLabel } from "../domain/labels";
import type { GroupView } from "../domain/types";
import { blockMessage, totalsAcrossGroups } from "../domain/view";
import { CurrencyAmounts } from "./money";

/**
 * Helps the customer understand what they'll pay without ever adding
 * currencies together: one line per order, then a per-currency total, and a
 * plain explanation of why there are several payments.
 */
export function CartSummary({ groups }: { groups: readonly GroupView[] }) {
  const orders = groups.filter((g) => !g.unavailable);
  const ready = orders.filter((g) => g.blockedBy.length === 0);
  const totals = totalsAcrossGroups(orders);
  const unpriced = orders.reduce((n, g) => n + g.unpricedCount, 0);
  const unavailable = groups.filter((g) => g.unavailable).reduce((n, g) => n + g.itemCount, 0);

  return (
    <section
      aria-labelledby="summary-heading"
      className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs"
    >
      <h2 id="summary-heading" className="font-heading text-lg font-semibold">
        Summary
      </h2>

      <ul className="flex flex-col gap-3 text-sm">
        {orders.map((g, i) => (
          <li key={g.type} className="flex items-start justify-between gap-3">
            <span>
              <span className="text-muted-foreground">Order {i + 1}:</span> {g.title}
            </span>
            <span className="text-right">
              {g.subtotals.size > 0 && (
                <CurrencyAmounts totals={g.subtotals} className="justify-end" />
              )}
              {g.unpricedCount > 0 && (
                <span className="block text-xs text-warning-foreground">needs a duration</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {totals.size > 0 && (
        <div className="flex flex-col gap-1 border-t pt-3">
          <p className="text-sm font-semibold">Across all orders</p>
          <ul className="flex flex-col gap-0.5">
            {[...totals]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([currency, amount]) => (
                <li key={currency} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">In {currency}</span>
                  <CurrencyAmounts
                    totals={new Map([[currency, amount]])}
                    className="font-semibold"
                  />
                </li>
              ))}
          </ul>
          {unpriced > 0 && (
            <p className="text-xs text-warning-foreground">
              Plus {itemsLabel(unpriced)} whose price depends on the duration you choose.
            </p>
          )}
        </div>
      )}

      <p className="flex gap-2 rounded-lg bg-accent p-3 text-xs text-accent-foreground">
        <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          Each order is booked and paid separately
          {totals.size > 1
            ? ", and each currency is charged on its own. We never convert or add up different currencies"
            : ""}
          . If one order has a problem, the others aren&apos;t affected.
        </span>
      </p>

      {unavailable > 0 && (
        <p className="text-xs text-muted-foreground">
          {itemsLabel(unavailable)} no longer available {unavailable === 1 ? "isn't" : "aren't"}{" "}
          included.
        </p>
      )}

      <Link
        href={`/cart/checkout?groups=${ready.map((g) => g.type).join(",")}`}
        aria-disabled={ready.length === 0}
        tabIndex={ready.length === 0 ? -1 : undefined}
        onClick={(e) => ready.length === 0 && e.preventDefault()}
        className={cn(
          buttonVariants({ size: "lg" }),
          "w-full",
          ready.length === 0 && "pointer-events-none opacity-50",
        )}
      >
        {ready.length === orders.length
          ? `Check out ${ready.length === 1 ? "1 order" : `all ${ready.length} orders`}`
          : `Check out ${ready.length} of ${orders.length} orders`}
        <ArrowRightIcon aria-hidden />
      </Link>
      {ready.length < orders.length && (
        <ul className="-mt-2 flex flex-col gap-0.5 text-xs text-muted-foreground">
          {orders
            .filter((g) => g.blockedBy.length > 0)
            .map((g) => (
              <li key={g.type}>
                {g.title}: {blockMessage(g.blockedBy[0]!).toLowerCase()}
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
