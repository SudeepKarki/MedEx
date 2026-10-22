"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { ExplorerFilters } from "../domain/filters";
import { parseFilters, serializeFilters } from "../domain/url-state";

export type HistoryMode = "push" | "replace";

/**
 * Filters read from, and written to, the URL. There is no other copy of this
 * state: back/forward, reload and shared links all go through here.
 *
 * Writes use the History API directly. Next.js syncs pushState/replaceState
 * with useSearchParams, so the page re-renders from the new URL without a
 * server round-trip (filtering is entirely client-side).
 */
export function useUrlFilters() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const queryString = searchParams.toString();

  const filters = useMemo(() => parseFilters(new URLSearchParams(queryString)), [queryString]);

  const setFilters = useCallback(
    (next: ExplorerFilters, mode: HistoryMode = "push") => {
      const query = serializeFilters(next);
      const url = query ? `${pathname}?${query}` : pathname;
      if (url === `${window.location.pathname}${window.location.search}`) return;
      if (mode === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [pathname],
  );

  /** True when the address bar isn't in canonical form (junk params, odd order). */
  const isCanonical = queryString === serializeFilters(filters);

  return { filters, setFilters, isCanonical };
}
