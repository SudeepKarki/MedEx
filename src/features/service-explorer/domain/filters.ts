import type { ServiceType } from "./types";

export const SORT_KEYS = ["relevance", "price-asc", "price-desc", "rating"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const SORT_LABELS: Record<SortKey, string> = {
  relevance: "Best match",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  rating: "Highest rated",
};

/**
 * Everything that defines a view of the explorer. This is what the URL
 * encodes: the URL is the source of truth, this is its parsed form.
 *
 * Within a facet, selected options are OR-ed; across facets they're AND-ed.
 */
export interface ExplorerFilters {
  q: string;
  types: ServiceType[];
  /** Category keys (`type.slug`). */
  categories: string[];
  /** Subcategory keys (`type.slug.sub`); each narrows its (selected) parent category. */
  subcategories: string[];
  providers: number[];
  /** Country codes ("TH"). A country includes all of its cities. */
  countries: string[];
  /** City keys ("TH.bangkok"). */
  cities: string[];
  /** Price filtering always happens within one currency. */
  currency: string | null;
  /** Whole currency units, inclusive. Only meaningful with a currency. */
  priceMin: number | null;
  priceMax: number | null;
  homeTest: boolean;
  sort: SortKey;
  page: number;
}

export const DEFAULT_FILTERS: ExplorerFilters = {
  q: "",
  types: [],
  categories: [],
  subcategories: [],
  providers: [],
  countries: [],
  cities: [],
  currency: null,
  priceMin: null,
  priceMax: null,
  homeTest: false,
  sort: "relevance",
  page: 1,
};

/** The facets a customer can remove one at a time (chips, empty-state suggestions). */
export type FacetId = "q" | "type" | "category" | "provider" | "location" | "price" | "homeTest";

/** Removes one facet's selection and goes back to page 1. */
export function clearFacet(filters: ExplorerFilters, facet: FacetId): ExplorerFilters {
  const next = { ...filters, page: 1 };
  switch (facet) {
    case "q":
      return { ...next, q: "" };
    case "type":
      return { ...next, types: [] };
    case "category":
      return { ...next, categories: [], subcategories: [] };
    case "provider":
      return { ...next, providers: [] };
    case "location":
      return { ...next, countries: [], cities: [] };
    case "price":
      return { ...next, currency: null, priceMin: null, priceMax: null };
    case "homeTest":
      return { ...next, homeTest: false };
  }
}

export function clearAllFilters(filters: ExplorerFilters): ExplorerFilters {
  return { ...DEFAULT_FILTERS, sort: filters.sort };
}

export function activeFacets(filters: ExplorerFilters): FacetId[] {
  const facets: FacetId[] = [];
  if (filters.q.trim()) facets.push("q");
  if (filters.types.length) facets.push("type");
  if (filters.categories.length) facets.push("category");
  if (filters.providers.length) facets.push("provider");
  if (filters.countries.length || filters.cities.length) facets.push("location");
  if (filters.currency) facets.push("price");
  if (filters.homeTest) facets.push("homeTest");
  return facets;
}

export function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

/** Toggling a category off also drops its subcategories. */
export function toggleCategory(filters: ExplorerFilters, categoryKey: string): ExplorerFilters {
  const selected = filters.categories.includes(categoryKey);
  return {
    ...filters,
    page: 1,
    categories: toggleValue(filters.categories, categoryKey),
    subcategories: selected
      ? filters.subcategories.filter((key) => !key.startsWith(`${categoryKey}.`))
      : filters.subcategories,
  };
}

/**
 * Location is a two-level tree with OR semantics. Checking a country selects
 * all its cities (and absorbs individually checked ones); unchecking one city
 * of a checked country leaves the others checked.
 */
export function toggleCountry(filters: ExplorerFilters, countryCode: string): ExplorerFilters {
  return {
    ...filters,
    page: 1,
    countries: toggleValue(filters.countries, countryCode),
    // Either way the country's individual cities go: checked, the country
    // covers them; unchecked, the whole branch is cleared.
    cities: filters.cities.filter((key) => !key.startsWith(`${countryCode}.`)),
  };
}

export function toggleCity(
  filters: ExplorerFilters,
  cityKey: string,
  siblingCityKeys: readonly string[],
): ExplorerFilters {
  const countryCode = cityKey.split(".")[0] ?? "";
  if (filters.countries.includes(countryCode)) {
    // Country was fully selected: replace it by its other cities.
    return {
      ...filters,
      page: 1,
      countries: filters.countries.filter((c) => c !== countryCode),
      cities: [
        ...filters.cities.filter((key) => !key.startsWith(`${countryCode}.`)),
        ...siblingCityKeys.filter((key) => key !== cityKey),
      ],
    };
  }
  const cities = toggleValue(filters.cities, cityKey);
  const allSelected =
    siblingCityKeys.length > 1 && siblingCityKeys.every((k) => cities.includes(k));
  if (allSelected) {
    // Every city checked: collapse into the country.
    return {
      ...filters,
      page: 1,
      countries: [...filters.countries, countryCode],
      cities: cities.filter((key) => !key.startsWith(`${countryCode}.`)),
    };
  }
  return { ...filters, page: 1, cities };
}
