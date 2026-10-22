"use client";

import { InfoIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { announce } from "@/components/app/live-announcer";
import { useIsClient } from "@/hooks/use-is-client";
import { currencyName, formatCount } from "@/lib/money";
import { useRegisterMockEndpoints } from "@/lib/mock-controls/use-register-mock-endpoints";
import { EXPLORER_ENDPOINT_LIST } from "../api/endpoints";
import { useCatalog } from "../api/use-catalog";
import type { ExplorerView } from "../domain/engine";
import type { ExplorerFilters, SortKey } from "../domain/filters";
import { pluralize } from "../domain/labels";
import type { Catalog } from "../domain/types";
import { sanitizeFilters, serializeFilters } from "../domain/url-state";
import { markFilterInteraction, useExplorerView } from "../hooks/use-explorer-view";
import { useSearchDraft } from "../hooks/use-search-draft";
import {
  isLocationCanonical,
  readLocationFilters,
  useUrlFilters,
  type FilterUpdate,
  type HistoryMode,
} from "../hooks/use-url-filters";
import { ActiveFilterChips } from "./active-filter-chips";
import { CompareTray } from "./compare";
import { DataReport } from "./data-report";
import { FilterPanel } from "./filters/filter-panel";
import { MobileFilterDrawer } from "./mobile-filter-drawer";
import { ResultsList } from "./results-list";
import { ResultsPagination } from "./results-pagination";
import { SearchBox } from "./search-box";
import { SortSelect } from "./sort-select";
import { EmptyState } from "./states/empty-state";
import { ErrorState, OfflineWaitingState } from "./states/error-state";
import { LoadingState } from "./states/loading-state";
import { FiltersSkeleton } from "./states/skeletons";

const ANNOUNCE_DELAY_MS = 700;

export function ServiceExplorer() {
  useRegisterMockEndpoints(EXPLORER_ENDPOINT_LIST);
  const pathname = usePathname();
  const { filters: urlFilters, queryString, updateFilters } = useUrlFilters();
  const catalogState = useCatalog();
  const { catalog, index } = catalogState;

  // Drop values the catalog doesn't know (old links), once it has loaded.
  const appliedFilters = useMemo(
    () => (catalog ? sanitizeFilters(urlFilters, catalog).filters : urlFilters),
    [catalog, urlFilters],
  );

  // The search box runs ahead of the URL (see useSearchDraft). The ref always
  // holds what's in the box *now*, for building URL changes at click time.
  const [query, setQuery] = useSearchDraft(urlFilters.q, (q, mode) =>
    updateFilters((current) => ({ ...current, q, page: 1 }), mode),
  );
  const queryRef = useRef(query);
  useEffect(() => {
    queryRef.current = query;
  }, [query]);
  const onQueryChange = useCallback(
    (value: string) => {
      queryRef.current = value;
      setQuery(value);
    },
    [setQuery],
  );

  /**
   * Every filter change goes through here. It's an updater applied to the
   * address bar as it is now, plus the search box's current text (which may
   * not have reached the URL yet), never to React state that may lag behind.
   */
  const navigate = useCallback(
    (update: FilterUpdate, mode: HistoryMode = "push") => {
      markFilterInteraction();
      updateFilters((current) => update({ ...current, q: queryRef.current.trim() }), mode);
    },
    [updateFilters],
  );

  // Typing must never wait for results, so only the search text is deferred:
  // React renders the keystroke first and recomputes results in the
  // background. Clicks change the URL and render once, in a single pass.
  const deferredQuery = useDeferredValue(query.trim());
  /** What the results show: the applied filters plus the (deferred) search text. */
  const filters = useMemo<ExplorerFilters>(
    () =>
      deferredQuery === appliedFilters.q
        ? appliedFilters
        : { ...appliedFilters, q: deferredQuery, page: 1 },
    [deferredQuery, appliedFilters],
  );
  const isUpdating = deferredQuery !== query.trim();

  const view = useExplorerView(index, filters);

  // The explorer can hydrate after the providers have already noticed we're
  // offline; reading that only after hydration keeps server and client HTML equal.
  const hydrated = useIsClient();
  const waitingForNetwork = hydrated && catalogState.isPaused && !view;

  useUrlHousekeeping({
    catalog,
    queryString,
    // Only a view computed from exactly what's in the address bar may correct its page number
    settled: useMemo(
      () => (!isUpdating && view ? { view, filters } : null),
      [isUpdating, view, filters],
    ),
    updateFilters,
  });
  useAnnounceResults(view);

  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusResultsHeading = useCallback(() => resultsHeadingRef.current?.focus(), []);
  const goToPage = (page: number) => {
    navigate((current) => ({ ...current, page }));
    resultsHeadingRef.current?.scrollIntoView({ block: "start" });
    resultsHeadingRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-6 pb-28 sm:px-6 lg:pt-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            Find health services
          </h1>
          <p className="text-muted-foreground">
            Compare check-ups, lab tests and treatments from clinics, hospitals and labs in
            Thailand, Nepal and India.
          </p>
        </div>
        <search className="max-w-3xl">
          <SearchBox value={query} onChange={onQueryChange} />
        </search>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain pr-2 pb-8">
            <h2 className="sr-only">Filters</h2>
            {view && catalog ? (
              <FilterPanel
                filters={appliedFilters}
                facets={view.facets}
                catalog={catalog}
                onChange={navigate}
              />
            ) : catalogState.error || waitingForNetwork ? null : (
              <FiltersSkeleton />
            )}
          </div>
        </aside>

        <section aria-labelledby="results-heading" className="flex min-w-0 flex-col gap-4">
          {catalogState.error && !view ? (
            <>
              <h2 id="results-heading" className="sr-only">
                Results
              </h2>
              <ErrorState
                error={catalogState.error}
                failedSources={catalogState.failedSources}
                onRetry={catalogState.retry}
                retrying={catalogState.isFetching}
              />
            </>
          ) : waitingForNetwork ? (
            <>
              <h2 id="results-heading" className="sr-only">
                Results
              </h2>
              <OfflineWaitingState />
            </>
          ) : !view || !catalog || !index ? (
            <>
              <h2 id="results-heading" className="sr-only">
                Results
              </h2>
              <LoadingState loaded={catalogState.loadedCount} total={catalogState.totalCount} />
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2
                  id="results-heading"
                  ref={resultsHeadingRef}
                  tabIndex={-1}
                  className="scroll-mt-20 font-heading text-lg font-semibold tabular-nums outline-none sm:text-xl"
                >
                  {formatCount(view.totalServices)} {pluralize(view.totalServices, "service")}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    from {formatCount(view.totalProviders)}{" "}
                    {pluralize(view.totalProviders, "provider")}
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  <MobileFilterDrawer
                    index={index}
                    filters={filters}
                    onApply={(draft) => navigate((current) => ({ ...draft, q: current.q }))}
                  />
                  <SortSelect
                    value={filters.sort}
                    onChange={(sort: SortKey) =>
                      navigate((current) => ({ ...current, sort, page: 1 }))
                    }
                  />
                </div>
              </div>

              <ActiveFilterChips
                filters={filters}
                catalog={catalog}
                onChange={navigate}
                onAllRemoved={focusResultsHeading}
              />
              <CurrencyNotice filters={filters} view={view} />

              <div aria-busy={isUpdating} className="flex flex-col gap-6">
                {view.totalServices === 0 ? (
                  <EmptyState filters={filters} view={view} onChange={navigate} />
                ) : (
                  <ResultsList
                    providers={view.providers}
                    catalog={catalog}
                    rangeActive={filters.priceMin !== null || filters.priceMax !== null}
                    showCurrencyHeadings={
                      (filters.sort === "price-asc" || filters.sort === "price-desc") &&
                      view.currencies.length > 1
                    }
                  />
                )}
                <ResultsPagination
                  filters={filters}
                  page={view.page}
                  totalPages={view.totalPages}
                  pathname={pathname}
                  onNavigate={goToPage}
                />
              </div>

              <footer className="flex justify-center border-t pt-4">
                <DataReport issues={catalog.issues} />
              </footer>
              <CompareTray index={index} filters={filters} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/** Explains what the price/currency choices are doing to the results. */
function CurrencyNotice({ filters, view }: { filters: ExplorerFilters; view: ExplorerView }) {
  if (filters.currency) {
    const hidden = [...view.facets.currencies.entries()]
      .filter(([code]) => code !== filters.currency)
      .reduce((sum, [, count]) => sum + count, 0);
    if (hidden === 0) return null;
    return (
      <p className="flex items-start gap-2 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
        <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          Showing services priced in {currencyName(filters.currency)} only. {formatCount(hidden)}{" "}
          {pluralize(hidden, "service")} priced in other currencies {hidden === 1 ? "is" : "are"}{" "}
          hidden, because we don&apos;t convert between currencies.
        </span>
      </p>
    );
  }
  if (
    (filters.sort === "price-asc" || filters.sort === "price-desc") &&
    view.currencies.length > 1
  ) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
        <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          These results are priced in {view.currencies.join(", ")}. Prices in different currencies
          can&apos;t be compared, so we sort within each currency, starting with the one with the
          most providers. Choose a currency under Price to see just one.
        </span>
      </p>
    );
  }
  return null;
}

/**
 * Keeps the address bar honest without adding history entries: unknown values
 * removed (with a note), out-of-range pages clamped, canonical form. Every
 * correction is an updater on the live URL, so it can never put back an older
 * state over a newer click.
 */
function useUrlHousekeeping({
  catalog,
  queryString,
  settled,
  updateFilters,
}: {
  catalog: Catalog | null;
  queryString: string;
  settled: { view: ExplorerView; filters: ExplorerFilters } | null;
  updateFilters: (update: FilterUpdate, mode: HistoryMode) => void;
}) {
  const reportedDrops = useRef<string>("");
  useEffect(() => {
    if (catalog) {
      const { dropped } = sanitizeFilters(readLocationFilters(), catalog);
      if (dropped.length > 0) {
        const key = dropped.join("|");
        if (reportedDrops.current !== key) {
          reportedDrops.current = key;
          toast.info("Some filters in this link are no longer available", {
            description: `Removed: ${dropped.join(", ")}.`,
          });
        }
        updateFilters((current) => sanitizeFilters(current, catalog).filters, "replace");
        return;
      }
    }
    if (
      settled &&
      settled.view.page !== settled.filters.page &&
      serializeFilters(settled.filters) === serializeFilters(readLocationFilters())
    ) {
      updateFilters((current) => ({ ...current, page: settled.view.page }), "replace");
      return;
    }
    if (!isLocationCanonical()) updateFilters((current) => current, "replace");
  }, [catalog, queryString, settled, updateFilters]);
}

/** Tells screen-reader users when the number of results changes (debounced). */
function useAnnounceResults(view: ExplorerView | null) {
  const last = useRef<string | null>(null);
  const message = view
    ? view.totalServices === 0
      ? "No services match your filters."
      : `${formatCount(view.totalServices)} ${pluralize(view.totalServices, "service")} from ${formatCount(view.totalProviders)} ${pluralize(view.totalProviders, "provider")}.`
    : null;
  useEffect(() => {
    if (!message || message === last.current) return;
    const timer = window.setTimeout(() => {
      last.current = message;
      announce(message);
    }, ANNOUNCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [message]);
}
