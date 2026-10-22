import { SearchXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/money";
import type { ExplorerView } from "../../domain/engine";
import {
  activeFacets,
  clearAllFilters,
  clearFacet,
  type ExplorerFilters,
  type FacetId,
} from "../../domain/filters";

const SUGGESTION_LABELS: Record<FacetId, (f: ExplorerFilters) => string> = {
  q: (f) => `Clear the search “${f.q.trim()}”`,
  type: () => "Remove the service type filter",
  category: () => "Remove the category filter",
  provider: () => "Remove the provider filter",
  location: () => "Search all locations",
  price: (f) =>
    f.priceMin !== null || f.priceMax !== null ? "Remove the price filter" : "Show all currencies",
  homeTest: () => "Include services without home testing",
};

/**
 * No results: offer the specific way out. Each suggestion removes one filter
 * and says how many results that would give (computed in the same pass as the
 * facet counts), best first.
 */
export function EmptyState({
  filters,
  view,
  onChange,
}: {
  filters: ExplorerFilters;
  view: ExplorerView;
  onChange: (next: ExplorerFilters) => void;
}) {
  const suggestions = activeFacets(filters)
    .map((facet) => ({ facet, count: view.withoutFacet[facet] }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="flex flex-col items-center gap-5 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <SearchXIcon aria-hidden className="size-10 text-muted-foreground" />
      <div className="flex max-w-md flex-col gap-2">
        <h3 className="font-heading text-xl font-semibold">No services match all your filters</h3>
        <p className="text-muted-foreground">
          {suggestions.length > 0
            ? "Removing one of these would bring results back:"
            : "Try a different search or clear your filters."}
        </p>
      </div>
      {suggestions.length > 0 && (
        <ul className="flex w-full max-w-sm flex-col gap-2">
          {suggestions.map(({ facet, count }) => (
            <li key={facet}>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => onChange(clearFacet(filters, facet))}
              >
                {SUGGESTION_LABELS[facet](filters)}
                <span className="text-muted-foreground tabular-nums">
                  {formatCount(count)} {count === 1 ? "result" : "results"}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="link" onClick={() => onChange(clearAllFilters(filters))}>
        Clear all filters
      </Button>
    </div>
  );
}
