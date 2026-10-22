"use client";

import { XIcon } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { currencyName, formatMoneyWhole } from "@/lib/money";
import {
  clearAllFilters,
  toggleCategory,
  toggleCity,
  type ExplorerFilters,
} from "../domain/filters";
import { SERVICE_TYPE_LABELS } from "../domain/labels";
import type { Catalog } from "../domain/types";
import type { FilterUpdate } from "../hooks/use-url-filters";

// Chip removals *remove*, they never toggle: pressing a chip twice before the
// list re-renders must not put the filter back.
const without = <T,>(values: readonly T[], value: T) => values.filter((v) => v !== value);

interface Chip {
  key: string;
  label: string;
  /** Applied to the latest filters when the chip is removed. */
  remove: FilterUpdate;
}

function buildChips(filters: ExplorerFilters, catalog: Catalog): Chip[] {
  const chips: Chip[] = [];
  const f = filters;
  if (f.q.trim())
    chips.push({ key: "q", label: `“${f.q.trim()}”`, remove: (g) => ({ ...g, q: "", page: 1 }) });
  for (const code of f.countries) {
    const country = catalog.countries.find((c) => c.code === code);
    chips.push({
      key: `country:${code}`,
      label: country?.name ?? code,
      remove: (g) => ({ ...g, countries: without(g.countries, code), page: 1 }),
    });
  }
  for (const key of f.cities) {
    const country = catalog.countries.find((c) => c.cities.some((city) => city.key === key));
    const city = country?.cities.find((c) => c.key === key);
    chips.push({
      key: `city:${key}`,
      label: city?.name ?? key,
      remove: (g) =>
        g.cities.includes(key) || g.countries.includes(key.slice(0, 2))
          ? toggleCity(g, key, country?.cities.map((c) => c.key) ?? [])
          : g,
    });
  }
  for (const type of f.types) {
    chips.push({
      key: `type:${type}`,
      label: SERVICE_TYPE_LABELS[type].plural,
      remove: (g) => ({ ...g, types: without(g.types, type), page: 1 }),
    });
  }
  if (f.currency) {
    const min = f.priceMin;
    const max = f.priceMax;
    const label =
      min !== null && max !== null
        ? `${formatMoneyWhole(min, f.currency)} – ${formatMoneyWhole(max, f.currency)}`
        : min !== null
          ? `From ${formatMoneyWhole(min, f.currency)}`
          : max !== null
            ? `Up to ${formatMoneyWhole(max, f.currency)}`
            : `Priced in ${currencyName(f.currency)}`;
    chips.push({
      key: "price",
      label,
      remove: (g) => ({ ...g, currency: null, priceMin: null, priceMax: null, page: 1 }),
    });
  }
  for (const key of f.categories) {
    const category = catalog.categoriesByKey.get(key);
    if (!category) continue;
    // Two categories share the title "Ultrasound": the type tells them apart.
    const duplicateTitle = catalog.categories.some(
      (c) => c.key !== key && c.title === category.title,
    );
    chips.push({
      key: `category:${key}`,
      label: duplicateTitle
        ? `${category.title} (${SERVICE_TYPE_LABELS[category.type].plural})`
        : category.title,
      remove: (g) => (g.categories.includes(key) ? toggleCategory(g, key) : g),
    });
  }
  for (const key of f.subcategories) {
    const sub = catalog.subcategoriesByKey.get(key);
    const parent = sub && catalog.categoriesByKey.get(sub.parentKey);
    if (!sub) continue;
    chips.push({
      key: `sub:${key}`,
      label: parent ? `${parent.title} › ${sub.title}` : sub.title,
      remove: (g) => ({ ...g, subcategories: without(g.subcategories, key), page: 1 }),
    });
  }
  if (f.homeTest) {
    chips.push({
      key: "home",
      label: "Home test",
      remove: (g) => ({ ...g, homeTest: false, page: 1 }),
    });
  }
  for (const id of f.providers) {
    chips.push({
      key: `provider:${id}`,
      label: catalog.providers.get(id)?.name ?? `Provider #${id}`,
      remove: (g) => ({ ...g, providers: without(g.providers, id), page: 1 }),
    });
  }
  return chips;
}

export function ActiveFilterChips({
  filters,
  catalog,
  onChange,
  onAllRemoved,
}: {
  filters: ExplorerFilters;
  catalog: Catalog;
  onChange: (update: FilterUpdate) => void;
  /** Where focus goes when the last chip disappears. */
  onAllRemoved: () => void;
}) {
  const chips = buildChips(filters, catalog);
  const listRef = useRef<HTMLUListElement>(null);

  // Keep keyboard focus in the chip row after a removal: move it to the chip
  // that takes the removed one's place (or the previous one). This must wait
  // until the new chip list is committed, which happens after the URL
  // transition, so the target is remembered and applied in a layout effect.
  const pendingFocus = useRef<number | null>(null);
  const chipKeys = chips.map((c) => c.key).join("|");
  useLayoutEffect(() => {
    const index = pendingFocus.current;
    if (index === null) return;
    pendingFocus.current = null;
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>("button");
    if (buttons?.length) buttons[Math.min(index, buttons.length - 1)]?.focus();
    else onAllRemoved();
  }, [chipKeys, onAllRemoved]);

  // The row keeps its height when empty, so adding the first filter doesn't
  // push the results down (layout shift).
  if (chips.length === 0) {
    return (
      <p className="flex min-h-8 items-center text-sm text-muted-foreground">
        No filters applied. Use the filters to narrow down.
      </p>
    );
  }

  const remove = (index: number) => {
    pendingFocus.current = index;
    onChange(chips[index]!.remove);
  };

  return (
    <div className="flex min-h-8 flex-wrap items-center gap-2">
      <h3 className="sr-only">Active filters</h3>
      <ul ref={listRef} className="flex flex-wrap items-center gap-2">
        {chips.map((chip, index) => (
          <li key={chip.key}>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 max-w-64 rounded-full pr-2 pl-3 font-normal"
              onClick={() => remove(index)}
            >
              <span className="truncate">{chip.label}</span>
              <XIcon aria-hidden />
              <span className="sr-only">, remove filter</span>
            </Button>
          </li>
        ))}
        {chips.length > 1 && (
          <li>
            <Button
              variant="link"
              size="sm"
              className="h-8"
              onClick={() => {
                pendingFocus.current = 0;
                onChange(clearAllFilters);
              }}
            >
              Clear all
            </Button>
          </li>
        )}
      </ul>
    </div>
  );
}
