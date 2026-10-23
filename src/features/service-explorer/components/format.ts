import { formatMoney, roundHalfUp, type CurrencyCode } from "@/lib/money";
import type { PriceQuote } from "../domain/types";

/**
 * The badge beside the struck-through price, which must agree with the two prices on
 * screen. "30% off" when they are 30% apart; with a fixed service charge they aren't,
 * so it says what they differ by instead.
 */
export function discountLabel(quote: PriceQuote, currency: CurrencyCode): string | null {
  const { discount, withoutDiscount, final } = quote;
  if (!discount) return null;
  const saved = withoutDiscount.minus(final);
  if (discount.kind === "percent" && saved.times(100).eq(withoutDiscount.times(discount.percent))) {
    return `${discount.percent.toString()}% off`;
  }
  return `${formatMoney(roundHalfUp(withoutDiscount).minus(roundHalfUp(final)), currency)} off`;
}

export function durationLabel(minutes: number | null): string {
  return minutes === null ? "" : `${minutes} min`;
}

/** "THB 4,999.00" is read as "THB four thousand…" by screen readers; that's fine. */
export function quoteAriaLabel(quote: PriceQuote, currency: CurrencyCode): string {
  const final = quote.final.eq(0) ? "Free" : formatMoney(quote.final, currency);
  if (!quote.discount) return final;
  return `${final}, reduced from ${formatMoney(quote.withoutDiscount, currency)}`;
}
