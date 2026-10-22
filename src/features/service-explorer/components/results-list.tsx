import { Fragment, useCallback, useState } from "react";
import { currencyName } from "@/lib/money";
import type { ProviderResult } from "../domain/engine";
import type { Catalog } from "../domain/types";
import { ProviderCard } from "./provider-card";

/**
 * The provider cards. When sorting by price across several currencies, a
 * heading marks where each currency's block starts: the order within a block
 * is by price, and blocks are never interleaved.
 */
export function ResultsList({
  providers,
  catalog,
  rangeActive,
  showCurrencyHeadings,
}: {
  providers: ProviderResult[];
  catalog: Catalog;
  rangeActive: boolean;
  showCurrencyHeadings: boolean;
}) {
  // Which providers' cards are expanded, by provider id: cards are reused for
  // other providers when results change (see the key below), so this can't
  // live inside the card.
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set());
  const toggleExpanded = useCallback(
    (providerId: number) =>
      setExpanded((current) => {
        const next = new Set(current);
        if (!next.delete(providerId)) next.add(providerId);
        return next;
      }),
    [],
  );

  return (
    <ol className="flex flex-col gap-4" aria-label="Providers">
      {providers.map((result, i) => {
        const currency = result.provider.currency;
        const startsBlock =
          showCurrencyHeadings && currency && currency !== providers[i - 1]?.provider.currency;
        return (
          // Keyed by position, not provider: when results change, React updates
          // the existing cards' text instead of tearing down and rebuilding the
          // DOM (much cheaper, and the list doesn't jump). Per-provider state
          // (expanded) is held above, by provider id, so nothing leaks.
          <Fragment key={i}>
            {startsBlock && (
              <li aria-hidden className="flex items-center gap-3 pt-2 first:pt-0">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Priced in {currencyName(currency)} ({currency})
                </span>
                <span className="h-px flex-1 bg-border" />
              </li>
            )}
            <li>
              <ProviderCard
                result={result}
                catalog={catalog}
                rangeActive={rangeActive}
                expanded={expanded.has(result.provider.id)}
                onToggleExpanded={toggleExpanded}
              />
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
