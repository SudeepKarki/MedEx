"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftIcon, CreditCardIcon, InfoIcon, StoreIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { NativeRadio } from "@/components/form/native-checkbox";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { durationLabel, itemsLabel } from "../../domain/labels";
import type { GroupView, PaymentMethod } from "../../domain/types";
import { blockMessage } from "../../domain/view";
import { useCart } from "../../hooks/use-cart";
import { useCheckoutSession } from "../../state/checkout-session";
import { CartSkeleton } from "../cart-skeleton";
import { CurrencyAmounts, currencyCountNote } from "../money";
import { ErrorState } from "../states";
import { draftFromGroup } from "./snapshot";
import { CheckoutSteps } from "./steps";

const formSchema = z.object({
  methods: z.record(z.string(), z.enum(["card", "pay_at_clinic"])),
});
type FormValues = z.infer<typeof formSchema>;

/**
 * Step 1: review each order and choose how to pay for it. The payment
 * choices are a React Hook Form form; submitting freezes the orders into a
 * persisted checkout session, and the runner takes it from there.
 */
export function ReviewStep() {
  const params = useSearchParams();
  const { query, groups } = useCart();
  const start = useCheckoutSession((s) => s.start);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  const requestedParam = params.get("groups");
  const candidates = useMemo(() => {
    const requested = requestedParam?.split(",").filter(Boolean) ?? null;
    return (groups ?? []).filter(
      (g) => !g.unavailable && (!requested || requested.includes(g.type)),
    );
  }, [groups, requestedParam]);
  const ready = candidates.filter((g) => g.blockedBy.length === 0);
  const notReady = candidates.filter((g) => g.blockedBy.length > 0);
  const readyKey = ready.map((g) => g.type).join(",");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { methods: {} },
  });
  // Every order starts as "pay by card"; the customer can change any of them.
  useEffect(() => {
    const current = form.getValues("methods");
    form.reset({
      methods: Object.fromEntries(
        readyKey
          .split(",")
          .filter(Boolean)
          .map((t) => [t, current[t] ?? "card"]),
      ),
    });
  }, [readyKey, form]);

  const onSubmit = form.handleSubmit(({ methods }) => {
    start(ready.map((g) => draftFromGroup(g, methods[g.type] ?? "card")));
  });

  if (query.isPending) return <CartSkeleton />;
  if (query.isError && !query.data) {
    return (
      <ErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <CheckoutSteps current={0} />
      <div className="flex flex-col gap-2">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="scroll-mt-32 font-heading text-2xl font-bold tracking-tight outline-none sm:text-3xl"
        >
          {ready.length === 1 ? "Review your order" : `Review your ${ready.length} orders`}
        </h1>
        {ready.length > 1 && (
          <p className="flex max-w-3xl gap-2 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
            <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              You&apos;re placing <strong>{ready.length} separate orders</strong>. Each one is
              booked and paid on its own, so if one has a problem the others still go through.
              You&apos;ll see what happened to each one on the next screen.
            </span>
          </p>
        )}
      </div>

      {ready.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center">
          <p className="font-medium">There&apos;s nothing ready to check out.</p>
          <Link href="/cart" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>
            <ArrowLeftIcon aria-hidden /> Back to cart
          </Link>
        </div>
      )}

      <ol className="flex flex-col gap-4">
        {ready.map((group, i) => (
          <li key={group.type}>
            <OrderReviewCard
              group={group}
              index={i + 1}
              of={ready.length}
              control={
                <Controller
                  control={form.control}
                  name={`methods.${group.type}`}
                  render={({ field }) => (
                    <PaymentChoice
                      value={(field.value as PaymentMethod | undefined) ?? "card"}
                      onChange={field.onChange}
                      group={group}
                    />
                  )}
                />
              }
            />
          </li>
        ))}
      </ol>

      {notReady.length > 0 && (
        <section
          className="rounded-xl border border-dashed p-4 text-sm"
          aria-labelledby="not-ready"
        >
          <h2 id="not-ready" className="font-semibold">
            Not included this time
          </h2>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {notReady.map((g) => (
              <li key={g.type}>
                {g.title}: {blockMessage(g.blockedBy[0]!).toLowerCase()}.{" "}
                <Link href="/cart" className="text-primary underline">
                  Fix in cart
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ready.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <Link href="/cart" className={buttonVariants({ variant: "ghost" })}>
            <ArrowLeftIcon aria-hidden /> Back to cart
          </Link>
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
            {ready.length === 1 ? "Place order" : `Place ${ready.length} orders`}
          </Button>
        </div>
      )}
    </form>
  );
}

function OrderReviewCard({
  group,
  index,
  of,
  control,
}: {
  group: GroupView;
  index: number;
  of: number;
  control: React.ReactNode;
}) {
  const note = currencyCountNote(group.subtotals);
  return (
    <section
      aria-labelledby={`review-${group.type}`}
      className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {of > 1 && (
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Order {index} of {of}
            </p>
          )}
          <h2 id={`review-${group.type}`} className="font-heading text-lg font-semibold">
            {group.title}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {itemsLabel(group.itemCount)}
            </span>
          </h2>
        </div>
        <div className="text-right">
          <CurrencyAmounts totals={group.subtotals} className="justify-end text-lg font-semibold" />
          {note && <p className="max-w-64 text-xs text-muted-foreground">{note}</p>}
        </div>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {group.lines.map((line) => (
          <li key={line.id} className="flex justify-between gap-3">
            <span>
              {line.product!.title}
              <span className="text-muted-foreground">
                {" "}
                · {line.product!.providerName}
                {line.chosenOption && ` · ${durationLabel(line.chosenOption.durationMinutes)}`}
                {line.quantity > 1 && ` · ×${line.quantity}`}
              </span>
            </span>
            <span className="tabular-nums">
              {formatMoney(line.lineTotal!, line.product!.currency)}
            </span>
          </li>
        ))}
      </ul>
      {control}
    </section>
  );
}

function PaymentChoice({
  value,
  onChange,
  group,
}: {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
  group: GroupView;
}) {
  const name = useId();
  const providers = [...new Set(group.lines.map((l) => l.product!.providerName))];
  const options: { value: PaymentMethod; title: string; detail: string; icon: React.ReactNode }[] =
    [
      {
        value: "card",
        title: "Pay now by card",
        detail: `Demo card •••• 4242.${group.subtotals.size > 1 ? " One charge per currency." : ""}`,
        icon: <CreditCardIcon aria-hidden className="size-4" />,
      },
      {
        value: "pay_at_clinic",
        title: "Pay at the clinic",
        detail: `Booked now; you pay ${providers.length === 1 ? providers[0] : "each provider"} when you visit.`,
        icon: <StoreIcon aria-hidden className="size-4" />,
      },
    ];
  return (
    <fieldset className="flex flex-col gap-2 border-t pt-4">
      <legend className="mb-2 text-sm font-semibold">How do you want to pay for this order?</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const id = `${name}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:border-primary/60",
                value === option.value && "border-primary bg-accent",
              )}
            >
              <NativeRadio
                id={id}
                name={name}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {option.icon}
                  {option.title}
                </span>
                <span className="text-xs text-muted-foreground">{option.detail}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
