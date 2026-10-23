import { InfoIcon } from "lucide-react";
import { LazyPopover } from "@/components/form/lazy-popover";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ServiceResult } from "../domain/engine";
import type { PriceQuote } from "../domain/types";
import { discountLabel, durationLabel, quoteAriaLabel } from "./format";

interface PriceTagProps {
  result: ServiceResult;
  currency: CurrencyCode | null;
  /** A price range is active, so wellness "from" prices refer to it. */
  rangeActive: boolean;
}

/**
 * The price column of a service row. Always states exactly what the number
 * means: a final price, a "from" price for a duration, or why there is none.
 */
export function PriceTag({ result, currency, rangeActive }: PriceTagProps) {
  const { service, quote } = result;

  if (service.pricing.kind === "unavailable" || !currency || !quote) {
    return (
      <div className="flex flex-col items-end text-right">
        <span className="text-sm font-semibold">Price on request</span>
        <span className="text-xs text-muted-foreground">Ask the provider</span>
      </div>
    );
  }

  if (service.pricing.kind === "options") {
    const options = service.pricing.options;
    const single = options.length === 1;
    return (
      <div className="flex flex-col items-end text-right">
        {!single && <span className="text-xs text-muted-foreground">from</span>}
        <QuoteAmount quote={quote} currency={currency} />
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          for {durationLabel(quote.durationMinutes)}
          <DurationOptions
            options={options}
            currency={currency}
            title={service.title}
            highlightId={quote.optionId}
          />
        </span>
        {!single && (
          <span className="text-xs text-muted-foreground">
            {rangeActive && result.matchingOptionCount < options.length
              ? `${result.matchingOptionCount} of ${options.length} durations in your range`
              : `${options.length} durations`}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end text-right">
      <QuoteAmount quote={quote} currency={currency} />
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {quote.charge ? "incl. service charge" : "total"}
        <PriceBreakdown quote={quote} currency={currency} title={service.title} />
      </span>
    </div>
  );
}

function QuoteAmount({ quote, currency }: { quote: PriceQuote; currency: CurrencyCode }) {
  const discount = discountLabel(quote, currency);
  const free = quote.final.eq(0);
  return (
    <span className="flex flex-col items-end">
      {/* Visible parts are hidden from screen readers in favour of one clear sentence */}
      <span className="sr-only">{quoteAriaLabel(quote, currency)}</span>
      {quote.discount && (
        <span className="flex items-center gap-1.5" aria-hidden>
          <span className="rounded-sm bg-success-muted px-1.5 py-0.5 text-xs font-semibold text-success">
            {discount}
          </span>
          <s className="text-xs text-muted-foreground tabular-nums">
            {formatMoney(quote.withoutDiscount, currency)}
          </s>
        </span>
      )}
      <span
        aria-hidden
        className={cn(
          "text-lg font-extrabold tabular-nums",
          free ? "text-success" : "text-highlight",
        )}
      >
        {free ? "Free" : formatMoney(quote.final, currency)}
      </span>
    </span>
  );
}

function PriceBreakdown({
  quote,
  currency,
  title,
}: {
  quote: PriceQuote;
  currency: CurrencyCode;
  title: string;
}) {
  if (!quote.discount && !quote.charge) return null;
  const pct = (d: { kind: string; percent?: { toString(): string } } | null) =>
    d?.kind === "percent" && d.percent ? ` (${d.percent.toString()}%)` : "";
  return (
    <LazyPopover label={`Price breakdown for ${title}`} icon={<InfoIcon />} contentClassName="w-72">
      <p className="mb-2 text-sm font-semibold">How this price is made up</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm tabular-nums">
        <dt className="text-muted-foreground">Price</dt>
        <dd className="text-right">{formatMoney(quote.listPrice, currency)}</dd>
        {quote.discount && (
          <>
            <dt className="text-muted-foreground">Discount{pct(quote.discount)}</dt>
            <dd className="text-right text-success">
              −{formatMoney(quote.discountAmount, currency)}
            </dd>
          </>
        )}
        {quote.charge && (
          <>
            <dt className="text-muted-foreground">Service charge{pct(quote.charge)}</dt>
            <dd className="text-right">+{formatMoney(quote.chargeAmount, currency)}</dd>
          </>
        )}
        <dt className="border-t pt-1 font-semibold">You pay</dt>
        <dd className="border-t pt-1 text-right font-semibold">
          {formatMoney(quote.final, currency)}
        </dd>
      </dl>
      {quote.discount && quote.charge && (
        <p className="mt-2 text-xs text-muted-foreground">
          The service charge is worked out on the discounted price.
        </p>
      )}
    </LazyPopover>
  );
}

function DurationOptions({
  options,
  currency,
  title,
  highlightId,
}: {
  options: PriceQuote[];
  currency: CurrencyCode;
  title: string;
  highlightId: string | null;
}) {
  return (
    <LazyPopover
      label={`All durations and prices for ${title}`}
      icon={<InfoIcon />}
      contentClassName="w-64"
    >
      <p className="mb-1 text-sm font-semibold">Choose a duration when booking</p>
      <p className="mb-2 text-xs text-muted-foreground">
        The price depends on how long the treatment is.
      </p>
      <table className="w-full text-sm tabular-nums">
        <caption className="sr-only">Durations and prices for {title}</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Duration</th>
            <th scope="col">Price</th>
          </tr>
        </thead>
        <tbody>
          {options.map((option) => (
            <tr
              key={option.optionId ?? option.durationMinutes}
              className={cn(option.optionId === highlightId && "font-semibold")}
            >
              <td className="py-1">{durationLabel(option.durationMinutes)}</td>
              <td className="py-1 text-right">
                {option.discount && (
                  <s className="mr-2 text-xs text-muted-foreground">
                    {formatMoney(option.withoutDiscount, currency)}
                  </s>
                )}
                {formatMoney(option.final, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </LazyPopover>
  );
}
