import { formatMoney, type TotalsByCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Amounts in several currencies, kept apart: "THB 1,677.00 and NPR 12,520.00".
 * Joined with "and", never "+", which would read as a sum.
 */
export function CurrencyAmounts({
  totals,
  className,
  joiner = "and",
}: {
  totals: TotalsByCurrency;
  className?: string;
  joiner?: string;
}) {
  const entries = [...totals].sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5 tabular-nums", className)}>
      {entries.map(([currency, amount], i) => (
        <span key={currency} className="whitespace-nowrap">
          {i > 0 && <span className="mr-1.5 text-muted-foreground">{joiner}</span>}
          {formatMoney(amount, currency)}
        </span>
      ))}
    </span>
  );
}

export function currencyCountNote(totals: TotalsByCurrency): string | null {
  return totals.size > 1
    ? `Priced in ${totals.size} currencies. Each is charged separately and nothing is converted.`
    : null;
}
