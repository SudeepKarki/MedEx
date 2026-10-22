"use client";

import { XIcon } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { currencyName, formatMoneyWhole } from "@/lib/money";
import {
  clearAllFilters,
  toggleCity,
  toggleCountry,
  toggleValue,
  toggleCategory,
  type ExplorerFilters,
} from "../domain/filters";
import { SERVICE_TYPE_LABELS } from "../domain/labels";
import type { Catalog } from "../domain/types";

interface Chip {
  key: string;
  label: string;
  remove: () => ExplorerFilters;
}

function buildChips(filters: ExplorerFilters, catalog: Catalog): Chip[] {
  const chips: Chip[] = [];
  const f = filters;
  if (f.q.trim())
    chips.push({ key: "q", label: `“${f.q.trim()}”`, remove: () => ({ ...f, q: "", page: 1 }) });
  for (const code of f.countries) {
    const country = catalog.countries.find((c) => c.code === code);
    chips.push({
      key: `country:${code}`,
      label: country?.name ?? code,
      remove: () => toggleCountry(f, code),
    });
  }
  for (const key of f.cities) {
    const country = catalog.countries.find((c) => c.cities.some((city) => city.key === key));
    const city = country?.cities.find((c) => c.key === key);
    chips.push({
      key: `city:${key}`,
      label: city?.name ?? key,
      remove: () => toggleCity(f, key, country?.cities.map((c) => c.key) ?? []),
    });
  }
  for (const type of f.types) {
    chips.push({
      key: `type:${type}`,
      label: SERVICE_TYPE_LABELS[type].plural,
      remove: () => ({ ...f, types: toggleValue(f.types, type), page: 1 }),
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
      remove: () => ({ ...f, currency: null, priceMin: null, priceMax: null, page: 1 }),
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
      remove: () => toggleCategory(f, key),
    });
  }
  for (const key of f.subcategories) {
    const sub = catalog.subcategoriesByKey.get(key);
    const parent = sub && catalog.categoriesByKey.get(sub.parentKey);
    if (!sub) continue;
    chips.push({
      key: `sub:${key}`,
      label: parent ? `${parent.title} › ${sub.title}` : sub.title,
      remove: () => ({ ...f, subcategories: toggleValue(f.subcategories, key), page: 1 }),
    });
  }
  if (f.homeTest) {
    chips.push({
      key: "home",
      label: "Home test",
      remove: () => ({ ...f, homeTest: false, page: 1 }),
    });
  }
  for (const id of f.providers) {
    chips.push({
      key: `provider:${id}`,
      label: catalog.providers.get(id)?.name ?? `Provider #${id}`,
      remove: () => ({ ...f, providers: toggleValue(f.providers, id), page: 1 }),
    });
  }
  return chips;
}

export function ActiveFilterChips({
  filters,
  catalog,
  onChange,
}: {
  filters: ExplorerFilters;
  catalog: Catalog;
  onChange: (next: ExplorerFilters) => void;
}) {
  const chips = buildChips(filters, catalog);
  const listRef = useRef<HTMLUListElement>(null);
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
    onChange(chips[index]!.remove());
    // Keep keyboard focus in the chip row: move to the chip that takes this
    // one's place, or to "Clear all" when it was the last.
    requestAnimationFrame(() => {
      const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>("button");
      if (!buttons?.length) return;
      buttons[Math.min(index, buttons.length - 1)]?.focus();
    });
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
              onClick={() => onChange(clearAllFilters(filters))}
            >
              Clear all
            </Button>
          </li>
        )}
      </ul>
    </div>
  );
}
