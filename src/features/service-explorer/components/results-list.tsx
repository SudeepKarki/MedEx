import { Fragment } from "react";
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
  return (
    <ol className="flex flex-col gap-4" aria-label="Providers">
      {providers.map((result, i) => {
        const currency = result.provider.currency;
        const startsBlock =
          showCurrencyHeadings && currency && currency !== providers[i - 1]?.provider.currency;
        return (
          <Fragment key={result.provider.id}>
            {startsBlock && (
              <li aria-hidden className="flex items-center gap-3 pt-2 first:pt-0">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Priced in {currencyName(currency)} ({currency})
                </span>
                <span className="h-px flex-1 bg-border" />
              </li>
            )}
            <li>
              <ProviderCard result={result} catalog={catalog} rangeActive={rangeActive} />
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
