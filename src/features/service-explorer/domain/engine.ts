import type { CurrencyCode } from "@/lib/money";
import type { ExplorerFilters, FacetId, SortKey } from "./filters";
import { hasWordPrefix, normalizeText, tokenize } from "./text";
import type { Catalog, PriceQuote, Provider, Service, ServiceType } from "./types";

export const PROVIDERS_PER_PAGE = 10;

/**
 * Facet dimensions, as bit positions. Each active filter is one dimension; a
 * service is a result when it passes all of them.
 */
const Q = 0;
const TYPE = 1;
const CATEGORY = 2;
const SUBCATEGORY = 3;
const PROVIDER = 4;
const LOCATION = 5;
const PRICE = 6;
const HOME = 7;
const DIMENSIONS = 8;

/** A service joined with what filtering needs, precomputed once per catalog. */
export interface IndexedService {
  service: Service;
  provider: Provider;
  countryCode: string | null;
  cityKey: string | null;
  /** Every purchasable price in display minor units, ascending; empty if unpriced. */
  priceMinors: number[];
  quotes: PriceQuote[];
}

export interface ExplorerIndex {
  catalog: Catalog;
  services: IndexedService[];
}

export function createIndex(catalog: Catalog): ExplorerIndex {
  const services: IndexedService[] = [];
  for (const service of catalog.services) {
    const provider = catalog.providers.get(service.providerId);
    if (!provider) continue;
    const quotes =
      service.pricing.kind === "fixed"
        ? [service.pricing.quote]
        : service.pricing.kind === "options"
          ? service.pricing.options
          : [];
    services.push({
      service,
      provider,
      countryCode: provider.country?.code ?? null,
      cityKey: provider.city?.key ?? null,
      quotes,
      priceMinors: quotes.map((q) => q.finalMinor).sort((a, b) => a - b),
    });
  }
  return { catalog, services };
}

export interface Facets {
  types: Map<ServiceType, number>;
  categories: Map<string, number>;
  subcategories: Map<string, number>;
  providers: Map<number, number>;
  countries: Map<string, number>;
  cities: Map<string, number>;
  /** Results per currency if the price filter were set to that currency (no range). */
  currencies: Map<CurrencyCode, number>;
  /** Cheapest price (minor units) of each service passing every other filter, per currency. */
  priceSamples: Map<CurrencyCode, number[]>;
  homeTest: number;
}

export interface ServiceResult {
  service: Service;
  /** The price to headline: the cheapest option, within the price range if one is set. */
  quote: PriceQuote | null;
  /** For wellness: how many durations fall within the price range (all if none set). */
  matchingOptionCount: number;
  score: number;
}

export interface ProviderResult {
  provider: Provider;
  /** All matching services, sorted for display. The card shows the first few. */
  services: ServiceResult[];
  /**
   * Price of the first service on the card (minor units): the cheapest when
   * sorting low→high, the dearest when sorting high→low. Sorting providers by
   * it keeps the visible list in order.
   */
  leadPriceMinor: number | null;
  relevance: number;
}

export interface ExplorerView {
  totalServices: number;
  totalProviders: number;
  page: number;
  totalPages: number;
  /** Providers on the requested page. */
  providers: ProviderResult[];
  facets: Facets;
  /** How many results there would be with one facet removed (for the empty state). */
  withoutFacet: Record<FacetId, number>;
  /** Currencies present in the results, in display order. */
  currencies: CurrencyCode[];
}

interface Compiled {
  tokens: string[];
  phrase: string;
  types: Set<ServiceType> | null;
  categories: Set<string> | null;
  subsByCategory: Map<string, Set<string>>;
  providers: Set<number> | null;
  countries: Set<string>;
  cities: Set<string>;
  location: boolean;
  currency: CurrencyCode | null;
  minMinor: number;
  maxMinor: number;
  homeTest: boolean;
}

function compile(filters: ExplorerFilters): Compiled {
  const subsByCategory = new Map<string, Set<string>>();
  for (const key of filters.subcategories) {
    const parent = key.slice(0, key.lastIndexOf("."));
    if (!filters.categories.includes(parent)) continue;
    let set = subsByCategory.get(parent);
    if (!set) subsByCategory.set(parent, (set = new Set()));
    set.add(key);
  }
  return {
    tokens: tokenize(filters.q),
    phrase: normalizeText(filters.q),
    types: filters.types.length ? new Set(filters.types) : null,
    categories: filters.categories.length ? new Set(filters.categories) : null,
    subsByCategory,
    providers: filters.providers.length ? new Set(filters.providers) : null,
    countries: new Set(filters.countries),
    cities: new Set(filters.cities),
    location: filters.countries.length > 0 || filters.cities.length > 0,
    currency: filters.currency,
    // The customer sees whole units; compare in minor units, inclusive.
    minMinor: filters.currency && filters.priceMin !== null ? filters.priceMin * 100 : -Infinity,
    maxMinor: filters.currency && filters.priceMax !== null ? filters.priceMax * 100 : Infinity,
    homeTest: filters.homeTest,
  };
}

function inRange(c: Compiled, minor: number) {
  return minor >= c.minMinor && minor <= c.maxMinor;
}

function passes(c: Compiled, s: IndexedService, dimension: number): boolean {
  const service = s.service;
  switch (dimension) {
    case Q:
      return c.tokens.every((t) => hasWordPrefix(service.searchText, t));
    case TYPE:
      return !c.types || c.types.has(service.type);
    case CATEGORY:
      return (
        !c.categories || (service.categoryKey !== null && c.categories.has(service.categoryKey))
      );
    case SUBCATEGORY: {
      const subs = service.categoryKey ? c.subsByCategory.get(service.categoryKey) : undefined;
      return !subs || (service.subcategoryKey !== null && subs.has(service.subcategoryKey));
    }
    case PROVIDER:
      return !c.providers || c.providers.has(service.providerId);
    case LOCATION:
      return (
        !c.location ||
        (s.countryCode !== null && c.countries.has(s.countryCode)) ||
        (s.cityKey !== null && c.cities.has(s.cityKey))
      );
    case PRICE:
      if (!c.currency) return true;
      if (service.currency !== c.currency) return false;
      if (c.minMinor === -Infinity && c.maxMinor === Infinity) return true;
      return s.priceMinors.some((m) => inRange(c, m));
    case HOME:
      return !c.homeTest || service.homeTest.available;
    default:
      return true;
  }
}

function increment<K>(map: Map<K, number>, key: K | null) {
  if (key !== null) map.set(key, (map.get(key) ?? 0) + 1);
}

/** Adds a service to the counts of one facet dimension. */
function countFacet(facets: Facets, dimension: number, s: IndexedService) {
  const service = s.service;
  switch (dimension) {
    case TYPE:
      return increment(facets.types, service.type);
    case CATEGORY:
      return increment(facets.categories, service.categoryKey);
    case SUBCATEGORY:
      return increment(facets.subcategories, service.subcategoryKey);
    case PROVIDER:
      return increment(facets.providers, service.providerId);
    case LOCATION:
      increment(facets.countries, s.countryCode);
      return increment(facets.cities, s.cityKey);
    case PRICE: {
      if (!service.currency) return;
      increment(facets.currencies, service.currency);
      const cheapest = s.priceMinors[0];
      if (cheapest === undefined) return;
      let samples = facets.priceSamples.get(service.currency);
      if (!samples) facets.priceSamples.set(service.currency, (samples = []));
      samples.push(cheapest);
      return;
    }
    case HOME:
      if (service.homeTest.available) facets.homeTest += 1;
      return;
  }
}

/**
 * Filters, counts facets, ranks and paginates, in a single pass over the
 * services.
 *
 * Facet counts are "disjunctive": each option's count is the number of results
 * you'd get by selecting it, given every *other* active filter. For each
 * service we find which dimensions it fails:
 *   - none → it's a result, and it counts towards every facet;
 *   - exactly one → it counts only towards that dimension's options (selecting
 *     another option there would bring it in);
 *   - two or more → no single change brings it in, so it counts nowhere.
 * That is O(services × dimensions) and correct with any number of filters.
 */
export function computeView(index: ExplorerIndex, filters: ExplorerFilters): ExplorerView {
  const c = compile(filters);
  const facets: Facets = {
    types: new Map(),
    categories: new Map(),
    subcategories: new Map(),
    providers: new Map(),
    countries: new Map(),
    cities: new Map(),
    currencies: new Map(),
    priceSamples: new Map(),
    homeTest: 0,
  };
  const failedOnly = new Array<number>(DIMENSIONS).fill(0);
  const matched: IndexedService[] = [];

  for (const s of index.services) {
    let failedDimension = -1;
    let failures = 0;
    for (let d = 0; d < DIMENSIONS; d++) {
      if (!passes(c, s, d)) {
        failedDimension = d;
        if (++failures > 1) break;
      }
    }
    if (failures === 0) {
      matched.push(s);
      for (let d = 1; d < DIMENSIONS; d++) countFacet(facets, d, s);
    } else if (failures === 1) {
      failedOnly[failedDimension]! += 1;
      countFacet(facets, failedDimension, s);
    }
  }

  const total = matched.length;
  const withoutFacet: Record<FacetId, number> = {
    q: total + failedOnly[Q]!,
    type: total + failedOnly[TYPE]!,
    // A service can't fail both: a subcategory only filters inside a selected category.
    category: total + failedOnly[CATEGORY]! + failedOnly[SUBCATEGORY]!,
    provider: total + failedOnly[PROVIDER]!,
    location: total + failedOnly[LOCATION]!,
    price: total + failedOnly[PRICE]!,
    homeTest: total + failedOnly[HOME]!,
  };

  const ranked = rankProviders(matched, c, filters.sort);
  const totalPages = Math.max(1, Math.ceil(ranked.providers.length / PROVIDERS_PER_PAGE));
  const page = Math.min(Math.max(1, filters.page), totalPages);

  return {
    totalServices: total,
    totalProviders: ranked.providers.length,
    page,
    totalPages,
    providers: ranked.providers.slice((page - 1) * PROVIDERS_PER_PAGE, page * PROVIDERS_PER_PAGE),
    facets,
    withoutFacet,
    currencies: ranked.currencies,
  };
}

// ---------------------------------------------------------------------------
// Ranking

/** Weight of rating relative to text match in "Best match" (see README). */
const RATING_WEIGHT = 2;

function scoreText(c: Compiled, service: Service): number {
  if (c.tokens.length === 0) return 0;
  let score = 0;
  if (service.titleText.startsWith(c.phrase)) score += 40;
  else if (c.tokens.length > 1 && service.titleText.includes(c.phrase)) score += 30;
  for (const token of c.tokens) {
    if (hasWordPrefix(service.titleText, token)) score += 10;
    else if (hasWordPrefix(service.categoryText, token)) score += 5;
    else score += 2; // matched the provider's name
  }
  return score;
}

function headlineQuote(
  c: Compiled,
  s: IndexedService,
): { quote: PriceQuote | null; count: number } {
  const eligible = s.quotes.filter((q) => inRange(c, q.finalMinor));
  if (eligible.length === 0) return { quote: null, count: 0 };
  let cheapest = eligible[0]!;
  for (const q of eligible) if (q.finalMinor < cheapest.finalMinor) cheapest = q;
  return { quote: cheapest, count: eligible.length };
}

const byName = (a: ProviderResult, b: ProviderResult) =>
  a.provider.name.localeCompare(b.provider.name) || a.provider.id - b.provider.id;

/** Ascending (1) or descending (-1), with nulls last either way. */
function comparePrice(a: number | null, b: number | null, direction: 1 | -1): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return (a - b) * direction;
}

function rankProviders(matched: IndexedService[], c: Compiled, sort: SortKey) {
  const groups = new Map<number, { provider: Provider; services: ServiceResult[] }>();
  for (const s of matched) {
    const { quote, count } = headlineQuote(c, s);
    let group = groups.get(s.provider.id);
    if (!group) groups.set(s.provider.id, (group = { provider: s.provider, services: [] }));
    group.services.push({
      service: s.service,
      quote,
      matchingOptionCount: count,
      score: scoreText(c, s.service),
    });
  }

  const direction = sort === "price-desc" ? -1 : 1;
  const providers: ProviderResult[] = [];
  for (const { provider, services } of groups.values()) {
    services.sort((a, b) => {
      if (sort === "price-asc" || sort === "price-desc") {
        return (
          comparePrice(a.quote?.finalMinor ?? null, b.quote?.finalMinor ?? null, direction) ||
          a.service.title.localeCompare(b.service.title)
        );
      }
      return (
        b.score - a.score ||
        comparePrice(a.quote?.finalMinor ?? null, b.quote?.finalMinor ?? null, 1) ||
        a.service.title.localeCompare(b.service.title)
      );
    });
    const priced = services.filter((s) => s.quote !== null).map((s) => s.quote!.finalMinor);
    const leadPriceMinor = priced.length
      ? direction === 1
        ? Math.min(...priced)
        : Math.max(...priced)
      : null;
    const bestText = services.reduce((max, s) => Math.max(max, s.score), 0);
    providers.push({
      provider,
      services,
      leadPriceMinor,
      relevance: bestText + RATING_WEIGHT * provider.bayesianRating,
    });
  }

  // Prices in different currencies can't be compared, so price sorting groups
  // providers by currency (largest group first) and sorts within each.
  const providersPerCurrency = new Map<string, number>();
  for (const p of providers) increment(providersPerCurrency, p.provider.currency ?? "");
  const currencies = [...providersPerCurrency.entries()]
    .filter(([code]) => code !== "")
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([code]) => code);
  const currencyRank = (p: ProviderResult) => {
    const i = currencies.indexOf(p.provider.currency ?? "");
    return i === -1 ? currencies.length : i;
  };

  providers.sort((a, b) => {
    switch (sort) {
      case "price-asc":
      case "price-desc":
        return (
          currencyRank(a) - currencyRank(b) ||
          comparePrice(a.leadPriceMinor, b.leadPriceMinor, direction) ||
          byName(a, b)
        );
      case "rating":
        return (
          comparePrice(a.provider.rating, b.provider.rating, -1) || // unrated last
          b.provider.reviewCount - a.provider.reviewCount ||
          byName(a, b)
        );
      case "relevance":
        return b.relevance - a.relevance || b.services.length - a.services.length || byName(a, b);
    }
  });

  return { providers, currencies };
}
