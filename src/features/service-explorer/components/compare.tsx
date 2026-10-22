"use client";

import { ColumnsIcon, XIcon } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useIsClient } from "@/hooks/use-is-client";
import { formatCount, formatMoney } from "@/lib/money";
import { computeView, type ExplorerIndex, type ProviderResult } from "../domain/engine";
import type { ExplorerFilters } from "../domain/filters";
import { SERVICE_TYPE_LABELS } from "../domain/labels";
import type { Provider } from "../domain/types";
import { MAX_COMPARE, useCompare } from "../state/compare-store";
import { ProviderAvatar } from "./provider-avatar";
import { ProviderRating } from "./provider-rating";

/**
 * "I'd like to compare a few hospitals side by side before I commit."
 * Customers tick up to three providers; the tray stays at the bottom and the
 * comparison reflects their current filters.
 */
export function CompareTray({
  index,
  filters,
}: {
  index: ExplorerIndex;
  filters: ExplorerFilters;
}) {
  const isClient = useIsClient();
  const ids = useCompare((s) => s.providerIds);
  const remove = useCompare((s) => s.remove);
  const clear = useCompare((s) => s.clear);
  if (!isClient || ids.length === 0) return null;

  return (
    <section
      aria-label="Providers to compare"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 shadow-[0_-4px_12px_rgb(0_0_0/0.06)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
        <p className="text-sm font-medium">
          Compare <span className="tabular-nums">{ids.length}</span> of {MAX_COMPARE}
        </p>
        <ul className="flex flex-1 flex-wrap gap-2">
          {ids.map((id) => {
            const provider = index.catalog.providers.get(id);
            return (
              <li key={id}>
                <Button
                  variant="secondary"
                  size="sm"
                  className="max-w-56 rounded-full font-normal"
                  onClick={() => remove(id)}
                >
                  <span className="truncate">{provider?.name ?? `Provider #${id}`}</span>
                  <XIcon aria-hidden />
                  <span className="sr-only">, remove from comparison</span>
                </Button>
              </li>
            );
          })}
        </ul>
        <Button variant="ghost" size="sm" onClick={clear}>
          Clear
        </Button>
        <CompareDialog index={index} filters={filters} ids={ids} />
      </div>
    </section>
  );
}

function CompareDialog({
  index,
  filters,
  ids,
}: {
  index: ExplorerIndex;
  filters: ExplorerFilters;
  ids: number[];
}) {
  const results = useMemo(() => {
    const view = computeView(index, { ...filters, providers: ids, page: 1 });
    // All selected providers fit on one page (max 3 < page size).
    const byId = new Map(view.providers.map((p) => [p.provider.id, p]));
    return ids.map((id) => ({
      id,
      provider: index.catalog.providers.get(id),
      result: byId.get(id),
    }));
  }, [index, filters, ids]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={ids.length < 2}>
          <ColumnsIcon aria-hidden />
          {ids.length < 2 ? "Pick one more to compare" : "Compare side by side"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Compare providers</DialogTitle>
          <DialogDescription>
            Based on your current filters. Prices are in each provider&apos;s own currency and
            aren&apos;t converted.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="sr-only">Side-by-side comparison of selected providers</caption>
            <thead>
              <tr>
                <td className="w-36" />
                {results.map(({ id, provider }) => (
                  <th key={id} scope="col" className="p-3 text-left align-top">
                    {provider && (
                      <div className="flex items-center gap-2">
                        <ProviderAvatar id={id} name={provider.name} className="size-9" />
                        <span className="font-heading font-semibold">{provider.name}</span>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="[&_td]:p-3 [&_td]:align-top [&_th]:p-3 [&_th]:text-left [&_th]:align-top [&_th]:font-medium [&_th]:text-muted-foreground [&_tr]:border-t">
              <Row
                label="Rating"
                cells={results}
                render={({ provider }) => provider && <ProviderRating provider={provider} />}
              />
              <Row
                label="Location"
                cells={results}
                render={({ provider }) =>
                  provider?.city && provider.country
                    ? `${provider.city.name}, ${provider.country.name}`
                    : "Not listed"
                }
              />
              <Row
                label="Prices in"
                cells={results}
                render={({ provider }) => provider?.currency ?? "—"}
              />
              <Row
                label="Matching services"
                cells={results}
                render={({ result }) =>
                  result ? formatCount(result.services.length) : "None with your filters"
                }
              />
              <Row
                label="Price range"
                cells={results}
                render={({ result, provider }) => priceRange(result, provider?.currency ?? null)}
              />
              <Row
                label="Cheapest match"
                cells={results}
                render={({ result, provider }) => {
                  const cheapest = cheapestService(result);
                  if (!cheapest || !provider?.currency || !cheapest.quote) return "—";
                  return (
                    <>
                      <span className="font-medium">{cheapest.service.title}</span>
                      <br />
                      <span className="tabular-nums">
                        {formatMoney(cheapest.quote.final, provider.currency)}
                      </span>
                      {cheapest.service.pricing.kind === "options" && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({cheapest.quote.durationMinutes} min)
                        </span>
                      )}
                    </>
                  );
                }}
              />
              <Row
                label="Home tests"
                cells={results}
                render={({ result }) => {
                  const n =
                    result?.services.filter((s) => s.service.homeTest.available).length ?? 0;
                  return n > 0 ? `${formatCount(n)} available` : "None";
                }}
              />
              <Row
                label="Offers"
                cells={results}
                render={({ result }) =>
                  result
                    ? [
                        ...new Set(
                          result.services.map((s) => SERVICE_TYPE_LABELS[s.service.type].plural),
                        ),
                      ].join(", ")
                    : "—"
                }
              />
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface Cell {
  id: number;
  provider: Provider | undefined;
  result: ProviderResult | undefined;
}

function Row({
  label,
  cells,
  render,
}: {
  label: string;
  cells: Cell[];
  render: (cell: Cell) => React.ReactNode;
}) {
  return (
    <tr>
      <th scope="row">{label}</th>
      {cells.map((cell) => (
        <td key={cell.id}>{render(cell)}</td>
      ))}
    </tr>
  );
}

function cheapestService(result: ProviderResult | undefined) {
  return result?.services
    .filter((s) => s.quote)
    .reduce<ProviderResult["services"][number] | null>(
      (best, s) => (!best || s.quote!.finalMinor < best.quote!.finalMinor ? s : best),
      null,
    );
}

function priceRange(result: ProviderResult | undefined, currency: string | null) {
  if (!result || !currency) return "—";
  const finals = result.services.flatMap((s) => (s.quote ? [s.quote.final] : []));
  if (finals.length === 0) return "Price on request";
  const min = finals.reduce((a, b) => (b.lt(a) ? b : a));
  const max = finals.reduce((a, b) => (b.gt(a) ? b : a));
  return min.eq(max)
    ? formatMoney(min, currency)
    : `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
}
