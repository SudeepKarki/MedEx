import type { CurrencyCode, Decimal } from "@/lib/money";

export const SERVICE_TYPES = ["package", "lab_test", "wellness", "service", "insurance"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export function isServiceType(value: unknown): value is ServiceType {
  return typeof value === "string" && (SERVICE_TYPES as readonly string[]).includes(value);
}

/**
 * One price the customer can actually pay: either a regular service's price or
 * a single wellness duration. Amounts are exact; nothing here is rounded.
 */
export interface PriceQuote {
  /** Wellness option id; null for regular services. */
  optionId: string | null;
  durationMinutes: number | null;
  listPrice: Decimal;
  discountAmount: Decimal;
  chargeAmount: Decimal;
  final: Decimal;
  /**
   * What the customer would pay without the discount (list price plus the
   * service charge computed on it). Shown struck through next to `final`, so
   * the comparison is like-for-like even when a service charge applies.
   */
  withoutDiscount: Decimal;
  discount: { kind: "percent"; percent: Decimal } | { kind: "amount" } | null;
  /** `final` rounded for display, in integer minor units: for filtering and sorting. */
  finalMinor: number;
}

export type ServicePricing =
  | { kind: "fixed"; quote: PriceQuote }
  /** Wellness: one quote per duration, sorted by duration. Never empty. */
  | { kind: "options"; options: PriceQuote[] }
  /** The data doesn't let us state a trustworthy price. */
  | { kind: "unavailable"; reason: "invalid-price" | "no-options" | "no-currency" };

export interface Service {
  id: string;
  slug: string;
  title: string;
  type: ServiceType;
  providerId: number;
  categoryKey: string | null;
  subcategoryKey: string | null;
  currency: CurrencyCode | null;
  pricing: ServicePricing;
  homeTest: { available: false } | { available: true; fee: Decimal | null };
  createdAt: string;
  /** Normalised title words, for relevance scoring. */
  titleText: string;
  /** Normalised title + category + subcategory + provider name, for matching. */
  searchText: string;
  /** Normalised category and subcategory titles, for relevance scoring. */
  categoryText: string;
}

export interface Provider {
  id: number;
  name: string;
  slug: string;
  currency: CurrencyCode | null;
  city: { key: string; name: string } | null;
  country: { code: string; name: string } | null;
  /** null when the provider has no reviews yet. */
  rating: number | null;
  reviewCount: number;
  /** Rating shrunk towards the marketplace average by review volume. */
  bayesianRating: number;
  nameText: string;
}

export interface Subcategory {
  /** `${type}.${categorySlug}.${slug}`: subcategory slugs repeat across parents ("thyroid"). */
  key: string;
  id: string;
  slug: string;
  title: string;
  position: number;
  parentKey: string;
}

export interface Category {
  /** `${type}.${slug}`: a slug is only unique within its type ("ultrasound"). */
  key: string;
  id: string;
  type: ServiceType;
  slug: string;
  title: string;
  position: number;
  children: Subcategory[];
}

export interface Country {
  code: string;
  name: string;
  cities: { key: string; name: string }[];
}

export type DataIssueCode =
  | "service-disabled"
  | "provider-inactive"
  | "provider-unknown"
  | "category-inactive"
  | "category-unknown"
  | "subcategory-mismatch"
  | "negative-price"
  | "unparseable-price"
  | "no-wellness-options"
  | "title-whitespace"
  | "no-category"
  | "no-rating"
  | "provider-slug-mismatch"
  | "provider-empty"
  | "home-test-fee-missing"
  | "invalid-record";

export interface DataIssue {
  code: DataIssueCode;
  entity: "service" | "provider" | "category";
  id: string;
  label: string;
  detail: string;
}

/** Everything the explorer needs, cleaned and indexed once after loading. */
export interface Catalog {
  /** Only services a customer may see. */
  services: Service[];
  providers: Map<number, Provider>;
  /** Providers with at least one visible service, by name: the provider filter's options. */
  providerList: Provider[];
  /** Active categories, ordered by position. */
  categories: Category[];
  categoriesByKey: Map<string, Category>;
  subcategoriesByKey: Map<string, Subcategory>;
  countries: Country[];
  currencies: CurrencyCode[];
  issues: DataIssue[];
}
