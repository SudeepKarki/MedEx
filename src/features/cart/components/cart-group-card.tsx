import { ArrowRightIcon, LockIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { itemsLabel } from "../domain/labels";
import type { GroupView } from "../domain/types";
import { blockMessage } from "../domain/view";
import { CartLineItem } from "./cart-line-item";
import { CurrencyAmounts, currencyCountNote } from "./money";

export function CartGroupCard({
  group,
  groups,
  orderNumber,
}: {
  group: GroupView;
  groups: readonly GroupView[];
  /** "Order 2 of 3", for groups that will become orders. */
  orderNumber: { index: number; of: number } | null;
}) {
  const locked = group.blockedBy.some((r) => r.kind === "in-checkout");
  // Offline: the cart stays readable, but nothing can be changed or saved.
  const offline = group.blockedBy.some((r) => r.kind === "offline");
  const ready = group.blockedBy.length === 0;
  const headingId = `group-heading-${group.type}`;
  const note = currencyCountNote(group.subtotals);

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex flex-col rounded-xl border bg-card shadow-card",
        group.unavailable && "border-dashed bg-muted/40 shadow-none",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b p-4 sm:p-5">
        <div className="flex flex-col gap-1">
          {orderNumber && (
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Order {orderNumber.index} of {orderNumber.of}
            </p>
          )}
          <h2
            id={headingId}
            tabIndex={-1}
            data-focus-id={`group-${group.type}`}
            className="scroll-mt-24 font-heading text-lg font-semibold outline-none"
          >
            {group.title}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {itemsLabel(group.itemCount)}
            </span>
          </h2>
        </div>
        {!group.unavailable && (
          <div className="flex flex-col items-end gap-0.5 text-right">
            <span className="text-xs text-muted-foreground">Subtotal</span>
            {group.subtotals.size > 0 ? (
              <CurrencyAmounts totals={group.subtotals} className="justify-end font-semibold" />
            ) : null}
            {group.unpricedCount > 0 && (
              <span className="text-xs font-medium text-warning-foreground">
                {group.subtotals.size > 0 ? "+ " : ""}
                {itemsLabel(group.unpricedCount)} without a price yet
              </span>
            )}
          </div>
        )}
      </header>

      <ul className="divide-y px-4 py-4 sm:px-5">
        {group.lines.map((line) => (
          <CartLineItem key={line.id} line={line} groups={groups} locked={locked || offline} />
        ))}
      </ul>

      {!group.unavailable && (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-0.5 text-sm">
            {ready ? (
              <span className="text-muted-foreground">
                Booked and paid as its own order{note ? `. ${note}` : "."}
              </span>
            ) : (
              group.blockedBy.map((reason, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1.5 font-medium text-warning-foreground"
                >
                  {reason.kind === "in-checkout" && <LockIcon aria-hidden className="size-3.5" />}
                  {blockMessage(reason)}
                </span>
              ))
            )}
          </div>
          {locked ? (
            <Badge variant="secondary">Checking out</Badge>
          ) : (
            <Link
              href={`/cart/checkout?groups=${encodeURIComponent(group.type)}`}
              aria-disabled={!ready}
              tabIndex={ready ? undefined : -1}
              onClick={(e) => !ready && e.preventDefault()}
              className={cn(
                buttonVariants({ variant: "outline" }),
                !ready && "pointer-events-none opacity-50",
              )}
            >
              Check out {group.title.toLowerCase()} only
              <ArrowRightIcon aria-hidden />
            </Link>
          )}
        </footer>
      )}
    </section>
  );
}
