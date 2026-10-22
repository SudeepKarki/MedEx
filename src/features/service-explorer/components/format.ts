import { formatMoney, type CurrencyCode } from "@/lib/money";
import type { PriceQuote } from "../domain/types";

export function discountLabel(quote: PriceQuote, currency: CurrencyCode): string | null {
  if (!quote.discount) return null;
  if (quote.discount.kind === "percent") return `${quote.discount.percent.toString()}% off`;
  return `${formatMoney(quote.discountAmount, currency)} off`;
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
