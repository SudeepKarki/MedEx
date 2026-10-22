import type { CurrencyCode } from "./currency";
import { roundHalfUp, type Decimal } from "./decimal";

const formatters = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: CurrencyCode, fractionDigits: number): Intl.NumberFormat {
  const key = `${currency}:${fractionDigits}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      // The ISO code ("THB 1,200.00") rather than a symbol: "Rs" is ambiguous
      // between NPR and INR, and results routinely mix currencies.
      currencyDisplay: "code",
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

/**
 * Format an exact amount for display. Rounding (half-up, 2 dp) happens here and
 * only here; the Big value is rounded before it is turned into a JS number, so
 * values like 10899.975 display as 10,899.98 instead of float-drifting to .97.
 */
export function formatMoney(amount: Decimal, currency: CurrencyCode): string {
  return getFormatter(currency, 2).format(Number(roundHalfUp(amount, 2).toFixed(2)));
}

/** Whole-unit format for compact UI such as filter bounds ("THB 5,000"). */
export function formatMoneyWhole(amount: number, currency: CurrencyCode): string {
  return getFormatter(currency, 0).format(amount);
}

const numberFormatter = new Intl.NumberFormat("en");

/** Format a count with grouping ("1,203"). */
export function formatCount(value: number): string {
  return numberFormatter.format(value);
}
