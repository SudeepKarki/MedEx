"use client";

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  ClockIcon,
  RefreshCwIcon,
  XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { decimal, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { GroupState } from "../../domain/checkout-machine";
import { durationLabel, itemsLabel } from "../../domain/labels";
import { useCheckoutSession, type SessionGroup } from "../../state/checkout-session";
import { CurrencyAmounts } from "../money";
import { totalsByProvider, totalsOf } from "./snapshot";

interface StatusCopy {
  label: string;
  tone: "neutral" | "busy" | "success" | "danger" | "warning";
  icon: ReactNode;
}

function statusCopy(state: GroupState): StatusCopy {
  switch (state.status) {
    case "queued":
      return { label: "Waiting its turn", tone: "neutral", icon: <CircleDashedIcon aria-hidden /> };
    case "submitting":
      return {
        label: state.attempt > 1 ? "Checking whether it went through…" : "Placing order…",
        tone: "busy",
        icon: <RefreshCwIcon aria-hidden className="animate-spin" />,
      };
    case "awaiting_payment":
      return { label: "Waiting for your bank…", tone: "busy", icon: <ClockIcon aria-hidden /> };
    case "confirmed":
      return state.outcome === "paid"
        ? { label: "Paid", tone: "success", icon: <CheckCircle2Icon aria-hidden /> }
        : {
            label: "Booked · pay at the clinic",
            tone: "success",
            icon: <CheckCircle2Icon aria-hidden />,
          };
    case "declined":
    case "conflict":
      return { label: "Not placed", tone: "danger", icon: <XCircleIcon aria-hidden /> };
    case "unknown":
      return {
        label: "Not confirmed yet",
        tone: "warning",
        icon: <AlertTriangleIcon aria-hidden />,
      };
  }
}

const TONES: Record<StatusCopy["tone"], string> = {
  neutral: "bg-muted text-muted-foreground",
  busy: "bg-accent text-accent-foreground",
  success: "bg-success-muted text-success",
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-warning-muted text-warning-foreground",
};

/** One order's live status, in words a customer understands, with what they can do next. */
export function OrderStatusCard({
  group,
  index,
  of,
}: {
  group: SessionGroup;
  index: number;
  of: number;
}) {
  const dispatch = useCheckoutSession((s) => s.dispatch);
  const { state } = group;
  const copy = statusCopy(state);
  const totals = totalsOf(group.totals);

  return (
    <article
      aria-labelledby={`order-${group.groupType}`}
      className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-xs"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {of > 1 && (
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Order {index} of {of}
            </p>
          )}
          <h2 id={`order-${group.groupType}`} className="font-heading text-lg font-semibold">
            {group.title}
          </h2>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium [&_svg]:size-4",
            TONES[copy.tone],
          )}
        >
          {copy.icon}
          {copy.label}
        </span>
      </header>

      <div className="text-sm">
        <StatusMessage
          group={group}
          totals={<CurrencyAmounts totals={totals} joiner="and" className="font-semibold" />}
        />
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          {itemsLabel(group.items.reduce((n, i) => n + i.quantity, 0))} ·{" "}
          {group.paymentMethod === "card" ? "Card" : "Pay at the clinic"}
        </summary>
        <ul className="mt-2 flex flex-col gap-1">
          {group.items.map((item) => (
            <li key={item.lineId} className="flex justify-between gap-3">
              <span>
                {item.title}
                <span className="text-muted-foreground">
                  {" "}
                  · {item.providerName}
                  {item.durationMinutes && ` · ${durationLabel(item.durationMinutes)}`}
                  {item.quantity > 1 && ` · ×${item.quantity}`}
                </span>
              </span>
              <span className="tabular-nums">
                {formatMoney(decimal(item.unitPrice).times(item.quantity), item.currency)}
              </span>
            </li>
          ))}
        </ul>
      </details>

      {state.status === "declined" && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => dispatch(group.groupType, { type: "retry" })}>
            <RefreshCwIcon aria-hidden />
            Try again{group.paymentMethod === "card" ? " by card" : ""}
          </Button>
          {group.paymentMethod === "card" && (
            <Button
              variant="outline"
              onClick={() =>
                dispatch(group.groupType, {
                  type: "change_payment",
                  paymentMethod: "pay_at_clinic",
                })
              }
            >
              Pay at the clinic instead
            </Button>
          )}
        </div>
      )}
      {state.status === "unknown" && state.attempt > 1 && (
        <div>
          <Button onClick={() => dispatch(group.groupType, { type: "retry" })}>
            <RefreshCwIcon aria-hidden />
            Check again
          </Button>
        </div>
      )}
      {state.status === "conflict" && (
        <div>
          <Link href="/cart" className={buttonVariants({ variant: "outline" })}>
            Review in your cart
          </Link>
        </div>
      )}
    </article>
  );
}

function StatusMessage({ group, totals }: { group: SessionGroup; totals: ReactNode }) {
  const { state } = group;
  switch (state.status) {
    case "queued":
      return <p className="text-muted-foreground">We&apos;ll place this order next.</p>;
    case "submitting":
      return (
        <p className="text-muted-foreground">
          {state.attempt > 1 ? (
            "We're asking about this exact order again, so it can't be placed twice."
          ) : (
            <>Placing your order for {totals}…</>
          )}
        </p>
      );
    case "awaiting_payment":
      return (
        <p>
          Order <OrderId id={state.orderId} /> is placed. We&apos;re waiting for your bank to
          confirm the payment of {totals}. This usually takes a few seconds; you can leave this
          page.
        </p>
      );
    case "confirmed":
      return state.outcome === "paid" ? (
        <p>
          Order <OrderId id={state.orderId} />. {totals} charged to your card.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <p>
            Order <OrderId id={state.orderId} /> is booked. Nothing has been charged; pay when you
            visit:
          </p>
          <ul className="list-disc pl-5">
            {totalsByProvider(group.items).map(({ provider, totals: t }) => (
              <li key={provider}>
                {provider}: <CurrencyAmounts totals={t} joiner="and" className="font-semibold" />
              </li>
            ))}
          </ul>
        </div>
      );
    case "declined":
      return (
        <p>
          {state.reason} <strong>You haven&apos;t been charged for this order</strong>, and its
          items are still in your cart.
        </p>
      );
    case "conflict":
      return (
        <p>
          {state.reason} Nothing was charged. Review your cart, then check out this order again.
        </p>
      );
    case "unknown":
      return (
        <p>
          We lost touch with our server before it confirmed this order.{" "}
          {state.attempt === 1 ? "Checking again in a moment… " : ""}When we check, we ask about
          this exact order, so <strong>you won&apos;t be charged twice</strong>.
        </p>
      );
  }
}

function OrderId({ id }: { id: string }) {
  return <span className="font-mono font-semibold">{id}</span>;
}
