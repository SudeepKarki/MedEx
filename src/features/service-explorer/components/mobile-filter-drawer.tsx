"use client";

import { SlidersHorizontalIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatCount } from "@/lib/money";
import { computeView, type ExplorerIndex } from "../domain/engine";
import {
  activeFacets,
  clearAllFilters,
  DEFAULT_FILTERS,
  type ExplorerFilters,
} from "../domain/filters";
import { pluralize } from "../domain/labels";
import type { FilterUpdate } from "../hooks/use-url-filters";
import { FilterPanel } from "./filters/filter-panel";

// Every filter, from the defaults (which must list them all), so a new one can't be missed here
const FILTER_KEYS = Object.keys(DEFAULT_FILTERS) as (keyof ExplorerFilters)[];

/**
 * Small screens: filters in a drawer, applied together. The pending selection
 * is a React Hook Form draft (nothing touches the URL until "Show results"),
 * and the button counts what the draft would produce, using the same engine
 * as the page, so the number is exactly what the customer will get.
 */
export function MobileFilterDrawer({
  index,
  filters,
  onApply,
}: {
  index: ExplorerIndex;
  filters: ExplorerFilters;
  onApply: (next: ExplorerFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<ExplorerFilters>({ defaultValues: filters });
  const draft = useWatch({ control: form.control }) as ExplorerFilters;
  const preview = useMemo(() => (open ? computeView(index, draft) : null), [open, index, draft]);
  const activeCount = activeFacets(filters).filter((f) => f !== "q").length;

  // Facets send updaters; here they apply to the draft form, not the URL.
  const updateDraft = (update: FilterUpdate) => {
    const current = form.getValues();
    const next = update(current);
    for (const key of FILTER_KEYS) {
      if (next[key] !== current[key]) form.setValue(key, next[key], { shouldDirty: true });
    }
  };

  const apply = form.handleSubmit((values) => {
    onApply(values);
    setOpen(false);
  });

  const count = preview?.totalServices ?? 0;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) form.reset(filters); // start from what's applied
        setOpen(next);
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" className="lg:hidden">
          <SlidersHorizontalIcon aria-hidden />
          Filters
          {activeCount > 0 && (
            <Badge className="ml-0.5 tabular-nums">
              {activeCount}
              <span className="sr-only"> active</span>
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="border-b">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Changes apply when you press &ldquo;Show&rdquo;.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {preview && (
            <FilterPanel
              filters={draft}
              facets={preview.facets}
              catalog={index.catalog}
              onChange={updateDraft}
            />
          )}
        </div>
        <SheetFooter className="flex-row gap-2 border-t bg-background">
          <Button
            variant="ghost"
            size="lg"
            onClick={() => updateDraft(clearAllFilters)}
            disabled={activeFacets(draft).length === 0}
          >
            Clear all
          </Button>
          <Button
            size="lg"
            className="flex-1 tabular-nums"
            onClick={() => void apply()}
            disabled={count === 0}
          >
            {count === 0
              ? "No matching services"
              : `Show ${formatCount(count)} ${pluralize(count, "service")}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
