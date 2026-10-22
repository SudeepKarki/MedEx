"use client";

import { SearchIcon } from "lucide-react";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Facets } from "../../domain/engine";
import { toggleValue, type ExplorerFilters } from "../../domain/filters";
import { normalizeText } from "../../domain/text";
import type { Catalog } from "../../domain/types";
import { FacetOption } from "./facet-option";
import { FacetSection } from "./facet-section";
import type { FilterChange } from "./types";

const COLLAPSED_COUNT = 6;

/**
 * Searchable multi-select. Selected providers stay pinned at the top; the rest
 * are alphabetical, with the ones that have no matches (disabled) after them.
 */
export function ProviderFacet({
  filters,
  facets,
  catalog,
  onChange,
}: {
  filters: ExplorerFilters;
  facets: Facets;
  catalog: Catalog;
  onChange: FilterChange;
}) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const inputId = useId();
  const listId = useId();

  const options = useMemo(() => {
    const needle = normalizeText(deferredQuery);
    const matches = catalog.providerList.filter((p) => !needle || p.nameText.includes(needle));
    const selected = new Set(filters.providers);
    const rank = (id: number) =>
      selected.has(id) ? 0 : (facets.providers.get(id) ?? 0) > 0 ? 1 : 2;
    return matches.sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
  }, [catalog.providerList, deferredQuery, filters.providers, facets.providers]);

  const searching = deferredQuery.trim().length > 0;
  const visible =
    showAll || searching
      ? options
      : options.slice(0, Math.max(COLLAPSED_COUNT, filters.providers.length));

  return (
    <FacetSection
      title="Provider"
      onClear={
        filters.providers.length
          ? () => onChange({ ...filters, providers: [], page: 1 })
          : undefined
      }
    >
      <div className="relative mb-1">
        <label htmlFor={inputId} className="sr-only">
          Search providers by name
        </label>
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search providers"
          className="pl-8"
          aria-controls={listId}
          autoComplete="off"
        />
      </div>
      <div id={listId} className="flex max-h-80 flex-col overflow-y-auto">
        {visible.map((provider) => (
          <FacetOption
            key={provider.id}
            label={provider.name}
            count={facets.providers.get(provider.id) ?? 0}
            checked={filters.providers.includes(provider.id)}
            onToggle={() =>
              onChange({
                ...filters,
                providers: toggleValue(filters.providers, provider.id),
                page: 1,
              })
            }
          />
        ))}
        {visible.length === 0 && (
          <p className="px-2 py-2 text-sm text-muted-foreground" role="status">
            No provider named &ldquo;{deferredQuery}&rdquo;.
          </p>
        )}
      </div>
      {!searching && options.length > COLLAPSED_COUNT && (
        <Button
          variant="link"
          size="sm"
          className="self-start px-2"
          aria-expanded={showAll}
          aria-controls={listId}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show fewer providers" : `Show all ${options.length} providers`}
        </Button>
      )}
    </FacetSection>
  );
}
