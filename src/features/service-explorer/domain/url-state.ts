import { DEFAULT_FILTERS, SORT_KEYS, type ExplorerFilters, type SortKey } from "./filters";
import { SERVICE_TYPES, isServiceType, type Catalog } from "./types";

/**
 * The URL ↔ filters codec. The URL is the source of truth: every filter, the
 * sort and the page live in it, so reload/share/back/forward all restore the
 * same view.
 *
 * `serializeFilters` is canonical: the same view always produces the same
 * query string (fixed key order, sorted lists, defaults omitted). That keeps
 * links stable and makes "did the view change?" a string comparison.
 */

const PARAM = {
  q: "q",
  types: "type",
  categories: "category",
  subcategories: "sub",
  providers: "provider",
  countries: "country",
  cities: "city",
  currency: "currency",
  priceMin: "min",
  priceMax: "max",
  homeTest: "home",
  sort: "sort",
  page: "page",
} as const;

export const MAX_QUERY_LENGTH = 100;
const MAX_PAGE = 10_000;
const CATEGORY_KEY = /^[a-z_]+\.[a-z0-9-]+(~[a-z0-9-]+)?$/;
const SUBCATEGORY_KEY = /^[a-z_]+\.[a-z0-9-]+(~[a-z0-9-]+)?\.[a-z0-9-]+$/;
const CITY_KEY = /^[A-Z]{2}\.[a-z0-9-]+$/;

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function getParam(source: ParamSource, key: string): string | null {
  if (source instanceof URLSearchParams) return source.get(key);
  const value = source[key];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function list(source: ParamSource, key: string): string[] {
  const value = getParam(source, key);
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  );
}

function wholeNumber(value: string | null): number | null {
  if (value === null || !/^\d{1,9}$/.test(value.trim())) return null;
  return Number(value.trim());
}

/**
 * Parses search params into filters. Purely syntactic, so it runs anywhere
 * (server or client) without the catalog; anything malformed is dropped
 * rather than throwing, because people hand-edit and truncate URLs.
 */
export function parseFilters(source: ParamSource): ExplorerFilters {
  const categories = list(source, PARAM.categories).filter((k) => CATEGORY_KEY.test(k));
  const currencyRaw = getParam(source, PARAM.currency)?.trim().toUpperCase() ?? "";
  const currency = /^[A-Z]{3}$/.test(currencyRaw) ? currencyRaw : null;
  let priceMin = currency ? wholeNumber(getParam(source, PARAM.priceMin)) : null;
  let priceMax = currency ? wholeNumber(getParam(source, PARAM.priceMax)) : null;
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
    [priceMin, priceMax] = [priceMax, priceMin];
  }
  const sortRaw = getParam(source, PARAM.sort);
  const page = wholeNumber(getParam(source, PARAM.page));
  const home = getParam(source, PARAM.homeTest);

  const countries = list(source, PARAM.countries)
    .map((c) => c.toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));

  return {
    q: truncateText((getParam(source, PARAM.q) ?? "").trim(), MAX_QUERY_LENGTH),
    types: list(source, PARAM.types).filter(isServiceType),
    categories,
    // A subcategory only means something under its selected parent.
    subcategories: list(source, PARAM.subcategories).filter(
      (k) => SUBCATEGORY_KEY.test(k) && categories.includes(k.slice(0, k.lastIndexOf("."))),
    ),
    providers: list(source, PARAM.providers)
      .map((v) => wholeNumber(v))
      .filter((v): v is number => v !== null && v > 0),
    countries,
    // A city inside a selected country is already included; keeping it would
    // make "untick this city" ambiguous.
    cities: list(source, PARAM.cities).filter(
      (k) => CITY_KEY.test(k) && !countries.includes(k.slice(0, 2)),
    ),
    currency,
    priceMin,
    priceMax,
    homeTest: home === "1" || home === "true",
    sort: (SORT_KEYS as readonly string[]).includes(sortRaw ?? "")
      ? (sortRaw as SortKey)
      : DEFAULT_FILTERS.sort,
    page: page !== null && page >= 1 ? Math.min(page, MAX_PAGE) : 1,
  };
}

/** Cuts by characters (code points), never through the middle of an emoji. */
export function truncateText(value: string, max: number): string {
  const chars = Array.from(value);
  return chars.length <= max ? value : chars.slice(0, max).join("");
}

const typeOrder = (t: string) => (SERVICE_TYPES as readonly string[]).indexOf(t);

/** Canonical query string (no leading "?"). Empty string for the default view. */
export function serializeFilters(filters: ExplorerFilters): string {
  const parts: [string, string][] = [];
  const add = (key: string, value: string) => parts.push([key, value]);
  const addList = (
    key: string,
    values: readonly (string | number)[],
    sort?: (a: string, b: string) => number,
  ) => {
    if (values.length === 0) return;
    const strings = Array.from(new Set(values.map(String)));
    add(key, strings.sort(sort).join(","));
  };

  // toWellFormed: a lone surrogate (half an emoji) would make encodeURIComponent throw
  const q = filters.q.trim().toWellFormed();
  if (q) add(PARAM.q, q);
  addList(PARAM.types, filters.types, (a, b) => typeOrder(a) - typeOrder(b));
  addList(PARAM.categories, filters.categories);
  addList(PARAM.subcategories, filters.subcategories);
  addList(PARAM.providers, filters.providers, (a, b) => Number(a) - Number(b));
  addList(PARAM.countries, filters.countries);
  addList(PARAM.cities, filters.cities);
  if (filters.currency) {
    add(PARAM.currency, filters.currency);
    if (filters.priceMin !== null) add(PARAM.priceMin, String(filters.priceMin));
    if (filters.priceMax !== null) add(PARAM.priceMax, String(filters.priceMax));
  }
  if (filters.homeTest) add(PARAM.homeTest, "1");
  if (filters.sort !== DEFAULT_FILTERS.sort) add(PARAM.sort, filters.sort);
  if (filters.page > 1) add(PARAM.page, String(filters.page));

  // Commas and dots are legal in a query string; leaving them unescaped keeps
  // shared links readable (type=package,lab_test rather than %2C).
  return parts.map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%2C/g, ",")}`).join("&");
}

export interface SanitizeResult {
  filters: ExplorerFilters;
  /** Human-readable descriptions of values that no longer exist. */
  dropped: string[];
}

/**
 * Drops values that parse fine but don't exist in the loaded catalog (a
 * provider that left, a renamed category), so an old shared link degrades
 * gracefully instead of showing a mysterious empty page.
 */
export function sanitizeFilters(filters: ExplorerFilters, catalog: Catalog): SanitizeResult {
  const dropped: string[] = [];
  const keep = <T>(values: T[], exists: (v: T) => boolean, describe: (v: T) => string) =>
    values.filter((v) => {
      if (exists(v)) return true;
      dropped.push(describe(v));
      return false;
    });

  const cityKeys = new Set(catalog.countries.flatMap((c) => c.cities.map((city) => city.key)));
  const countryCodes = new Set(catalog.countries.map((c) => c.code));
  const currencyKnown = filters.currency === null || catalog.currencies.includes(filters.currency);
  if (!currencyKnown) dropped.push(`prices in ${filters.currency}`);

  const categories = keep(
    filters.categories,
    (k) => catalog.categoriesByKey.has(k),
    (k) => `category "${k}"`,
  );

  return {
    dropped,
    filters: {
      ...filters,
      categories,
      subcategories: keep(
        filters.subcategories.filter((k) => categories.includes(k.slice(0, k.lastIndexOf(".")))),
        (k) => catalog.subcategoriesByKey.has(k),
        (k) => `subcategory "${k}"`,
      ),
      providers: keep(
        filters.providers,
        (id) => catalog.providers.has(id),
        (id) => `provider #${id}`,
      ),
      countries: keep(
        filters.countries,
        (c) => countryCodes.has(c),
        (c) => `country ${c}`,
      ),
      cities: keep(
        filters.cities,
        (k) => cityKeys.has(k),
        (k) => `city "${k}"`,
      ),
      ...(currencyKnown ? {} : { currency: null, priceMin: null, priceMax: null }),
    },
  };
}
