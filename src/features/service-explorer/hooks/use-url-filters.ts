"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { ExplorerFilters } from "../domain/filters";
import { parseFilters, serializeFilters } from "../domain/url-state";

export type HistoryMode = "push" | "replace";

/** A change to the filters, expressed against whatever they are when it's applied. */
export type FilterUpdate = (current: ExplorerFilters) => ExplorerFilters;

/** The filters in the address bar right now (the History API updates it synchronously). */
export function readLocationFilters(): ExplorerFilters {
  return parseFilters(new URLSearchParams(window.location.search));
}

/** True when the address bar already holds the canonical form of its own filters. */
export function isLocationCanonical(): boolean {
  return window.location.search.replace(/^\?/, "") === serializeFilters(readLocationFilters());
}

/**
 * Filters read from, and written to, the URL. There is no other copy of this
 * state: back/forward, reload and shared links all go through here.
 *
 * Reads come from `useSearchParams`, which Next.js updates in a transition, so
 * during a burst of clicks it can be a step behind the address bar. Writes
 * therefore never start from it: `updateFilters` takes an *updater* and applies
 * it to the filters in `window.location` at that moment, so a second click
 * can't overwrite the first. Writes use the History API, which Next.js syncs
 * with useSearchParams without a server round-trip.
 */
export function useUrlFilters() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const queryString = searchParams.toString();

  const filters = useMemo(() => parseFilters(new URLSearchParams(queryString)), [queryString]);

  const updateFilters = useCallback(
    (update: FilterUpdate, mode: HistoryMode = "push") => {
      const query = serializeFilters(update(readLocationFilters()));
      const url = query ? `${pathname}?${query}` : pathname;
      if (url === `${window.location.pathname}${window.location.search}`) return;
      if (mode === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [pathname],
  );

  return { filters, queryString, updateFilters };
}
