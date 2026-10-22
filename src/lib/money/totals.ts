import type { CurrencyCode } from "./currency";
import { ZERO, type Decimal } from "./decimal";

/**
 * A sum that keeps each currency separate. There is deliberately no way to
 * collapse it into a single number: the system has no exchange rates.
 */
export type TotalsByCurrency = ReadonlyMap<CurrencyCode, Decimal>;

export function sumByCurrency(
  entries: Iterable<{ currency: CurrencyCode; amount: Decimal }>,
): TotalsByCurrency {
  const totals = new Map<CurrencyCode, Decimal>();
  for (const { currency, amount } of entries) {
    totals.set(currency, (totals.get(currency) ?? ZERO).plus(amount));
  }
  return totals;
}
