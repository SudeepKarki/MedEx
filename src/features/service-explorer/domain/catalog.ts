import { normaliseCurrencyCode, parseDecimal, type CurrencyCode } from "@/lib/money";
import {
  rawCategorySchema,
  rawProviderSchema,
  rawServiceSchema,
  rawSubcategorySchema,
  rawWellnessOptionSchema,
  type RawCatalog,
  type RawService,
} from "../api/raw-schemas";
import { computeQuote } from "./pricing";
import { cleanDisplayText, normalizeText, withJoinedPairs } from "./text";
import {
  isServiceType,
  type Catalog,
  type Category,
  type Country,
  type DataIssue,
  type PriceQuote,
  type Provider,
  type Service,
  type ServicePricing,
  type Subcategory,
} from "./types";

/** Reviews it takes before a provider's own rating outweighs the marketplace average. */
const RATING_PRIOR_WEIGHT = 50;

/**
 * Turns the three raw API responses into the explorer's catalog. This is
 * where every data-quality decision lives (see the README, "What I did with
 * the data's mistakes"). Each decision is recorded as a DataIssue so the
 * report in the UI and the tests can check what happened.
 */
export function buildCatalog(raw: RawCatalog): Catalog {
  const issues: DataIssue[] = [];
  const categoryIndex = indexCategories(raw.categories, issues);
  const providers = indexProviders(raw.providers, issues);

  const services: Service[] = [];
  const report = {
    disabled: 0,
    byProvider: new Map<number, number>(),
    byCategory: new Map<string, number>(),
    uncategorised: 0,
  };

  for (const value of raw.services) {
    const parsed = rawServiceSchema.safeParse(value);
    if (!parsed.success) {
      issues.push({
        code: "invalid-record",
        entity: "service",
        id: recordId(value),
        label: "Unreadable service record",
        detail: "Skipped: required fields (id, title, type, provider) are missing or malformed.",
      });
      continue;
    }
    const record = parsed.data;
    const title = cleanDisplayText(record.title);

    if (!isServiceType(record.type)) {
      issues.push({
        code: "invalid-record",
        entity: "service",
        id: record.id,
        label: title,
        detail: `Skipped: unknown service type "${record.type}".`,
      });
      continue;
    }

    // Visibility rule 1: the service itself is switched on.
    if (record.status !== true) {
      report.disabled += 1;
      continue;
    }

    // Visibility rule 2: its provider exists and is active.
    const provider = providers.get(record.userId);
    if (!provider) {
      issues.push({
        code: "provider-unknown",
        entity: "service",
        id: record.id,
        label: title,
        detail: `Hidden: provider #${record.userId} doesn't exist.`,
      });
      continue;
    }
    if (!provider.active) {
      report.byProvider.set(provider.id, (report.byProvider.get(provider.id) ?? 0) + 1);
      continue;
    }

    // Visibility rule 3: its category, if it has one, is active.
    let category: Category | null = null;
    let subcategory: Subcategory | null = null;
    if (record.categoryId) {
      if (categoryIndex.inactiveIds.has(record.categoryId)) {
        const label = categoryIndex.inactiveIds.get(record.categoryId) ?? record.categoryId;
        report.byCategory.set(label, (report.byCategory.get(label) ?? 0) + 1);
        continue;
      }
      category = categoryIndex.byId.get(record.categoryId) ?? null;
      if (!category) {
        // We can't confirm the category is active, so we fail closed.
        issues.push({
          code: "category-unknown",
          entity: "service",
          id: record.id,
          label: title,
          detail: `Hidden: category ${record.categoryId} doesn't exist, so we can't confirm it's active.`,
        });
        continue;
      }
      if (record.subCategoryId) {
        if (categoryIndex.inactiveIds.has(record.subCategoryId)) {
          const label = categoryIndex.inactiveIds.get(record.subCategoryId) ?? record.subCategoryId;
          report.byCategory.set(label, (report.byCategory.get(label) ?? 0) + 1);
          continue;
        }
        const sub = categoryIndex.subById.get(record.subCategoryId);
        if (sub && sub.parentKey === category.key) {
          subcategory = sub;
        } else {
          issues.push({
            code: "subcategory-mismatch",
            entity: "service",
            id: record.id,
            label: title,
            detail: sub
              ? `Subcategory "${sub.title}" belongs to another category; shown under "${category.title}" only.`
              : `Subcategory ${record.subCategoryId} doesn't exist; shown under "${category.title}" only.`,
          });
        }
      }
    } else {
      report.uncategorised += 1; // still visible; counted for the data report
    }

    if (title !== record.title) {
      issues.push({
        code: "title-whitespace",
        entity: "service",
        id: record.id,
        label: JSON.stringify(record.title),
        detail: `Shown as "${title}". Stray spaces removed; casing left as typed, because guessing (HbA1c, BRCA1/2, IgE) would make it worse.`,
      });
    }

    const pricing = priceService(record, provider.currency, title, issues);
    const homeTest = homeTestOf(record, title, issues);
    const categoryText = withJoinedPairs(
      normalizeText([category?.title, subcategory?.title].filter(Boolean).join(" ")),
    );
    const titleText = normalizeText(title);

    services.push({
      id: record.id,
      slug: record.slug,
      title,
      type: record.type,
      providerId: provider.id,
      categoryKey: category?.key ?? null,
      subcategoryKey: subcategory?.key ?? null,
      currency: provider.currency,
      pricing,
      homeTest,
      createdAt: record.createdAt ?? "",
      titleText,
      categoryText,
      searchText: [withJoinedPairs(titleText), categoryText, withJoinedPairs(provider.nameText)]
        .filter(Boolean)
        .join(" "),
    });
  }

  reportDecisions(report, providers, issues);
  const publicProviders = finaliseProviders(providers);
  const { countries, currencies } = locationsAndCurrencies(services, publicProviders);

  const withServices = new Set(services.map((s) => s.providerId));
  for (const provider of publicProviders.values()) {
    if (withServices.has(provider.id)) continue;
    issues.push({
      code: "provider-empty",
      entity: "provider",
      id: String(provider.id),
      label: provider.name,
      detail:
        "Active provider with no services. Left out of the provider filter: it could only ever lead to an empty page.",
    });
  }

  return {
    services,
    providers: publicProviders,
    providerList: [...publicProviders.values()]
      .filter((p) => withServices.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name)),
    categories: categoryIndex.categories,
    categoriesByKey: new Map(categoryIndex.categories.map((c) => [c.key, c])),
    subcategoriesByKey: new Map(
      categoryIndex.categories.flatMap((c) => c.children.map((s) => [s.key, s] as const)),
    ),
    countries,
    currencies,
    issues,
  };
}

// ---------------------------------------------------------------------------
// Categories

interface CategoryIndex {
  categories: Category[];
  byId: Map<string, Category>;
  subById: Map<string, Subcategory>;
  /** id → title of categories/subcategories with status false. */
  inactiveIds: Map<string, string>;
}

function indexCategories(rawCategories: unknown[], issues: DataIssue[]): CategoryIndex {
  const categories: Category[] = [];
  const byId = new Map<string, Category>();
  const subById = new Map<string, Subcategory>();
  const inactiveIds = new Map<string, string>();
  const usedKeys = new Set<string>();

  for (const value of rawCategories) {
    const parsed = rawCategorySchema.safeParse(value);
    const type = parsed.data?.type;
    if (!parsed.success || !isServiceType(type)) {
      issues.push({
        code: "invalid-record",
        entity: "category",
        id: recordId(value),
        label: "Unreadable category",
        detail: "Skipped: missing id/title/slug or unknown type.",
      });
      continue;
    }
    const raw = parsed.data;
    const title = cleanDisplayText(raw.title);
    if (raw.status !== true) {
      inactiveIds.set(raw.id, title);
      for (const child of raw.children ?? []) {
        const c = rawSubcategorySchema.safeParse(child);
        if (c.success) inactiveIds.set(c.data.id, `${title} › ${cleanDisplayText(c.data.title)}`);
      }
      issues.push({
        code: "category-inactive",
        entity: "category",
        id: raw.id,
        label: title,
        detail:
          "Category is switched off (status: false) but is still returned by /category/active. Hidden, with all its services.",
      });
      continue;
    }

    // Slugs are unique only within a type, so the key includes the type:
    // "package.ultrasound" and "lab_test.ultrasound" are different categories.
    let key = `${raw.type}.${raw.slug}`;
    if (usedKeys.has(key)) {
      key = `${key}~${raw.id.slice(0, 6)}`;
      issues.push({
        code: "invalid-record",
        entity: "category",
        id: raw.id,
        label: title,
        detail: `Duplicate slug "${raw.slug}" within type "${raw.type}". Disambiguated by id.`,
      });
    }
    usedKeys.add(key);

    const category: Category = {
      key,
      id: raw.id,
      type,
      slug: raw.slug,
      title,
      position: raw.position ?? Number.MAX_SAFE_INTEGER,
      children: [],
    };

    for (const child of raw.children ?? []) {
      const c = rawSubcategorySchema.safeParse(child);
      if (!c.success) continue;
      if (c.data.status !== true) {
        inactiveIds.set(c.data.id, `${title} › ${cleanDisplayText(c.data.title)}`);
        continue;
      }
      const sub: Subcategory = {
        key: `${key}.${c.data.slug}`,
        id: c.data.id,
        slug: c.data.slug,
        title: cleanDisplayText(c.data.title),
        position: c.data.position ?? Number.MAX_SAFE_INTEGER,
        parentKey: key,
      };
      category.children.push(sub);
      subById.set(sub.id, sub);
    }
    category.children.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
    categories.push(category);
    byId.set(category.id, category);
  }

  categories.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
  return { categories, byId, subById, inactiveIds };
}

// ---------------------------------------------------------------------------
// Providers

interface IndexedProvider extends Omit<Provider, "bayesianRating"> {
  active: boolean;
}

function indexProviders(
  rawProviders: unknown[],
  issues: DataIssue[],
): Map<number, IndexedProvider> {
  const providers = new Map<number, IndexedProvider>();
  for (const value of rawProviders) {
    const parsed = rawProviderSchema.safeParse(value);
    if (!parsed.success) {
      issues.push({
        code: "invalid-record",
        entity: "provider",
        id: recordId(value),
        label: "Unreadable provider",
        detail: "Skipped: missing id.",
      });
      continue;
    }
    const raw = parsed.data;
    const info = raw.providerInformation;
    const name = cleanDisplayText(raw.name || info?.companyName || `Provider #${raw.id}`);

    if (raw.username && info?.slug && raw.username !== info.slug) {
      issues.push({
        code: "provider-slug-mismatch",
        entity: "provider",
        id: String(raw.id),
        label: name,
        detail: `username "${raw.username}" ≠ providerInformation.slug "${info.slug}". The UI identifies providers by numeric id (in the URL too), so this doesn't matter to customers.`,
      });
    }

    const reviewCount = Math.max(0, Math.floor(info?.reviewCount ?? 0));
    const ratingValue = info?.rating;
    const rating =
      typeof ratingValue === "number" && ratingValue >= 0 && ratingValue <= 5 && reviewCount > 0
        ? ratingValue
        : null;
    if (rating === null && raw.status === "active") {
      issues.push({
        code: "no-rating",
        entity: "provider",
        id: String(raw.id),
        label: name,
        detail: `rating ${JSON.stringify(ratingValue ?? null)}, ${reviewCount} reviews → shown as "New on MedEx · no reviews yet", ranked at the marketplace average for relevance and last for "Rating".`,
      });
    }

    const countryCode = info?.country?.alphaCode?.trim().toUpperCase();
    const country =
      countryCode && info?.country
        ? { code: countryCode, name: cleanDisplayText(info.country.name) }
        : null;
    const city =
      info?.city && country
        ? { key: `${country.code}.${info.city.slug}`, name: cleanDisplayText(info.city.name) }
        : null;

    providers.set(raw.id, {
      id: raw.id,
      name,
      slug: info?.slug ?? raw.username ?? String(raw.id),
      currency: normaliseCurrencyCode(info?.currency),
      city,
      country,
      rating,
      reviewCount: rating === null ? 0 : reviewCount,
      nameText: normalizeText(name),
      active: raw.status === "active",
    });
  }
  return providers;
}

function finaliseProviders(indexed: Map<number, IndexedProvider>): Map<number, Provider> {
  const rated = [...indexed.values()].filter((p) => p.active && p.rating !== null);
  const mean = rated.length ? rated.reduce((sum, p) => sum + (p.rating ?? 0), 0) / rated.length : 0;

  const result = new Map<number, Provider>();
  for (const p of indexed.values()) {
    const { active, ...provider } = p;
    if (!active) continue;
    const bayesianRating =
      p.rating === null
        ? mean
        : (RATING_PRIOR_WEIGHT * mean + p.rating * p.reviewCount) /
          (RATING_PRIOR_WEIGHT + p.reviewCount);
    result.set(p.id, { ...provider, bayesianRating });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Prices and home tests

function priceService(
  record: RawService,
  currency: CurrencyCode | null,
  title: string,
  issues: DataIssue[],
): ServicePricing {
  if (!currency) {
    issues.push({
      code: "unparseable-price",
      entity: "service",
      id: record.id,
      label: title,
      detail: "Provider has no valid currency, so no price can be shown.",
    });
    return { kind: "unavailable", reason: "no-currency" };
  }

  if (record.type === "wellness") {
    const options: PriceQuote[] = [];
    for (const value of record.wellnessPricing ?? []) {
      const option = rawWellnessOptionSchema.safeParse(value);
      if (!option.success || option.data.durationInMinutes <= 0) continue;
      const result = computeQuote(option.data, {
        optionId: option.data.id,
        durationMinutes: option.data.durationInMinutes,
      });
      if (result.ok) options.push(result.quote);
      else
        issues.push({
          code: result.reason === "negative" ? "negative-price" : "unparseable-price",
          entity: "service",
          id: record.id,
          label: `${title} (${option.data.durationInMinutes} min)`,
          detail: `Duration option dropped: ${result.detail}.`,
        });
    }
    if (options.length === 0) {
      issues.push({
        code: "no-wellness-options",
        entity: "service",
        id: record.id,
        label: title,
        detail: 'Wellness service with no valid duration option: shown as "Price on request".',
      });
      return { kind: "unavailable", reason: "no-options" };
    }
    // Duplicate durations: keep the cheaper one (and sort by duration).
    const byDuration = new Map<number, PriceQuote>();
    for (const o of options) {
      const existing = byDuration.get(o.durationMinutes ?? 0);
      if (!existing || o.final.lt(existing.final)) byDuration.set(o.durationMinutes ?? 0, o);
    }
    return {
      kind: "options",
      options: [...byDuration.values()].sort(
        (a, b) => (a.durationMinutes ?? 0) - (b.durationMinutes ?? 0),
      ),
    };
  }

  const result = computeQuote(record);
  if (result.ok) return { kind: "fixed", quote: result.quote };
  issues.push({
    code: result.reason === "negative" ? "negative-price" : "unparseable-price",
    entity: "service",
    id: record.id,
    label: title,
    detail: `${capitalise(result.detail)}. Shown as "Price on request": we won't show a negative or made-up price, and clamping to 0 would advertise it as free. Excluded from price filters and listed last when sorting by price.`,
  });
  return { kind: "unavailable", reason: "invalid-price" };
}

function homeTestOf(record: RawService, title: string, issues: DataIssue[]): Service["homeTest"] {
  if (record.testAtHome !== true) return { available: false };
  const fee = record.homeTestCharge == null ? null : parseDecimal(record.homeTestCharge);
  if (fee === null || fee.lt(0)) {
    issues.push({
      code: "home-test-fee-missing",
      entity: "service",
      id: record.id,
      label: title,
      detail:
        'Home test offered without a valid visit fee: shown as "fee confirmed by the provider".',
    });
    return { available: true, fee: null };
  }
  return { available: true, fee };
}

// ---------------------------------------------------------------------------
// Report helpers

function reportDecisions(
  report: {
    disabled: number;
    byProvider: Map<number, number>;
    byCategory: Map<string, number>;
    uncategorised: number;
  },
  providers: Map<number, IndexedProvider>,
  issues: DataIssue[],
) {
  if (report.disabled > 0) {
    issues.push({
      code: "service-disabled",
      entity: "service",
      id: "*",
      label: `${report.disabled} services`,
      detail: "status: false. Hidden (visibility rule 1).",
    });
  }
  for (const [providerId, count] of report.byProvider) {
    const provider = providers.get(providerId);
    issues.push({
      code: "provider-inactive",
      entity: "provider",
      id: String(providerId),
      label: provider?.name ?? `Provider #${providerId}`,
      detail: `Provider status is not "active": ${count} otherwise-live services hidden (visibility rule 2).`,
    });
  }
  for (const [label, count] of report.byCategory) {
    issues.push({
      code: "category-inactive",
      entity: "service",
      id: label,
      label: `${count} services in "${label}"`,
      detail: "Category is switched off. Hidden (visibility rule 3).",
    });
  }
  if (report.uncategorised > 0) {
    issues.push({
      code: "no-category",
      entity: "service",
      id: "*",
      label: `${report.uncategorised} services`,
      detail:
        'No category. Visible (the rule only applies "if it has one"), found by search and the other filters, but not under any category.',
    });
  }
}

function locationsAndCurrencies(services: Service[], providers: Map<number, Provider>) {
  const countries = new Map<string, Country>();
  const cityKeys = new Set<string>();
  const currencies = new Set<CurrencyCode>();
  const providerIds = new Set(services.map((s) => s.providerId));
  for (const id of providerIds) {
    const p = providers.get(id);
    if (!p) continue;
    if (p.currency) currencies.add(p.currency);
    if (!p.country) continue;
    let country = countries.get(p.country.code);
    if (!country) {
      country = { ...p.country, cities: [] };
      countries.set(p.country.code, country);
    }
    if (p.city && !cityKeys.has(p.city.key)) {
      cityKeys.add(p.city.key);
      country.cities.push(p.city);
    }
  }
  const sortedCountries = [...countries.values()]
    .map((c) => ({ ...c, cities: c.cities.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { countries: sortedCountries, currencies: [...currencies].sort() };
}

function recordId(value: unknown): string {
  if (value && typeof value === "object" && "id" in value) return String(value.id);
  return "?";
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
