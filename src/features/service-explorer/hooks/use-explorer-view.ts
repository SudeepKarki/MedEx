"use client";

import { useDeferredValue, useEffect, useMemo } from "react";
import { recordMetric, timed } from "@/lib/dev-metrics/store";
import { computeView, type ExplorerIndex } from "../domain/engine";
import type { ExplorerFilters } from "../domain/filters";

let pendingInteraction: number | null = null;

/** Call when the customer changes a filter; the next results paint is timed against it. */
export function markFilterInteraction() {
  pendingInteraction = performance.now();
}

/**
 * Computes results and facet counts from a *deferred* copy of the filters, so
 * React renders the urgent update (the checkbox ticking, the letter appearing)
 * first and the results right after, never blocking input.
 */
export function useExplorerView(index: ExplorerIndex | null, filters: ExplorerFilters) {
  const deferredFilters = useDeferredValue(filters);

  const view = useMemo(
    () =>
      index
        ? timed("Engine: filter + count facets", () => computeView(index, deferredFilters))
        : null,
    [index, deferredFilters],
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

  return {
    view,
    /** The results on screen are from slightly older filters (a render is pending). */
    isUpdating: filters !== deferredFilters,
  };
}
