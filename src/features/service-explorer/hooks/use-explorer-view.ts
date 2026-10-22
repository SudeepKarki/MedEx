"use client";

import { useEffect, useMemo } from "react";
import { recordMetric, timed } from "@/lib/dev-metrics/store";
import { computeView, type ExplorerIndex } from "../domain/engine";
import type { ExplorerFilters } from "../domain/filters";

let pendingInteraction: number | null = null;

/** Call when the customer changes a filter; the next results paint is timed against it. */
export function markFilterInteraction() {
  pendingInteraction = performance.now();
}

/**
 * Results and facet counts for the given filters (one engine pass, ~1 ms for
 * all 3,200 services). The caller decides what to defer: the explorer defers
 * only the search text, so a click renders once and a keystroke never waits.
 */
export function useExplorerView(index: ExplorerIndex | null, filters: ExplorerFilters) {
  const view = useMemo(
    () =>
      index ? timed("Engine: filter + count facets", () => computeView(index, filters)) : null,
    [index, filters],
  );

  useEffect(() => {
    if (!view || pendingInteraction === null) return;
    const start = pendingInteraction;
    pendingInteraction = null;
    // rAF fires just before the next paint; the timeout lands just after it.
    requestAnimationFrame(() =>
      setTimeout(() => recordMetric("Filter change → results painted", performance.now() - start)),
    );
  }, [view]);

  return view;
}
