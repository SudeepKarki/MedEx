"use client";

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { apiRequest } from "@/lib/api/http-client";
import { ApiError } from "@/lib/api/errors";
import { buildCatalog } from "../domain/catalog";
import { createIndex, type ExplorerIndex } from "../domain/engine";
import type { Catalog } from "../domain/types";
import { EXPLORER_ENDPOINTS } from "./endpoints";
import { envelopeSchema } from "./raw-schemas";

async function fetchList(endpoint: string, path: string, signal: AbortSignal): Promise<unknown[]> {
  const body = await apiRequest({ endpoint, path, signal });
  const parsed = envelopeSchema.safeParse(body);
  if (!parsed.success) throw new ApiError("Unexpected response shape", "invalid-response");
  return parsed.data.data;
}

const SOURCES = [
  {
    key: "categories",
    name: "categories",
    id: EXPLORER_ENDPOINTS.categories.id,
    path: "/api/category/active",
  },
  {
    key: "providers",
    name: "providers",
    id: EXPLORER_ENDPOINTS.providers.id,
    path: "/api/providers",
  },
  { key: "services", name: "services", id: EXPLORER_ENDPOINTS.services.id, path: "/api/service" },
] as const;

export interface CatalogState {
  catalog: Catalog | null;
  index: ExplorerIndex | null;
  isLoading: boolean;
  /** Any request in flight, including a retry after an error. */
  isFetching: boolean;
  /** Waiting for the network to come back (TanStack pauses queries offline). */
  isPaused: boolean;
  /** First error among the failed sources, if any, and which sources failed. */
  error: unknown;
  failedSources: string[];
  /** Re-run only the requests that failed. */
  retry: () => void;
  /** All three requests, in order, for progress display. */
  loadedCount: number;
  totalCount: number;
}

/**
 * Loads the three endpoints in parallel and turns them into one cleaned,
 * indexed catalog. All three are needed before results can be shown: the
 * visibility rules depend on provider status and category status, and prices
 * on the provider's currency, so showing services without them could show
 * things a customer mustn't see.
 */
export function useCatalog(): CatalogState {
  const queries = useQueries({
    queries: SOURCES.map((source) => ({
      queryKey: ["explorer", source.key],
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchList(source.id, source.path, signal),
      staleTime: 10 * 60_000,
    })),
  });

  const [categories, providers, services] = queries;
  const categoriesData = categories?.data;
  const providersData = providers?.data;
  const servicesData = services?.data;

  const catalog = useMemo(() => {
    if (!categoriesData || !providersData || !servicesData) return null;
    return buildCatalog({
      categories: categoriesData,
      providers: providersData,
      services: servicesData,
    });
  }, [categoriesData, providersData, servicesData]);

  const index = useMemo(() => (catalog ? createIndex(catalog) : null), [catalog]);

  const failed = queries.map((q, i) => ({ q, source: SOURCES[i]! })).filter(({ q }) => q.isError);

  return {
    catalog,
    index,
    isLoading: queries.some((q) => q.isPending),
    isFetching: queries.some((q) => q.isFetching),
    isPaused: queries.some((q) => q.fetchStatus === "paused"),
    error: failed[0]?.q.error ?? null,
    failedSources: failed.map(({ source }) => source.name),
    retry: () => {
      for (const { q } of failed) void q.refetch();
    },
    loadedCount: queries.filter((q) => q.isSuccess).length,
    totalCount: queries.length,
  };
}
