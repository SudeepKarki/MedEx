import { describe, expect, it } from "vitest";
import { FREE_DENTAL_ID, VITAMIN_D_ID, fixtureCatalog, fixtureIndex } from "../test/fixture";
import { computeView, PROVIDERS_PER_PAGE } from "./engine";
import { DEFAULT_FILTERS, clearFacet, type ExplorerFilters, type FacetId } from "./filters";
import { SERVICE_TYPES } from "./types";

const index = fixtureIndex();
const catalog = fixtureCatalog();
const view = (filters: Partial<ExplorerFilters>) =>
  computeView(index, { ...DEFAULT_FILTERS, ...filters });
const allResults = (filters: Partial<ExplorerFilters>) => {
  const v = view({ ...filters, page: 1 });
  const pages = [v];
  for (let p = 2; p <= v.totalPages; p++) pages.push(view({ ...filters, page: p }));
  return pages.flatMap((page) => page.providers);
};

/** Small deterministic PRNG so the "random" combinations are reproducible. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

describe("facet counts", () => {
  /**
   * The defining property of a facet count: it equals the number of results
   * you'd get with that facet set to exactly that option, all other filters
   * unchanged. Checked by brute force across many filter combinations.
   */
  function expectCountsMatchBruteForce(filters: Partial<ExplorerFilters>) {
    const { facets } = view(filters);
    for (const type of SERVICE_TYPES) {
      expect(facets.types.get(type) ?? 0, `type ${type}`).toBe(
        view({ ...filters, types: [type] }).totalServices,
      );
    }
    for (const category of catalog.categories) {
      expect(facets.categories.get(category.key) ?? 0, `category ${category.key}`).toBe(
        view({ ...filters, categories: [category.key], subcategories: [] }).totalServices,
      );
    }
    for (const country of catalog.countries) {
      expect(facets.countries.get(country.code) ?? 0, `country ${country.code}`).toBe(
        view({ ...filters, countries: [country.code], cities: [] }).totalServices,
      );
      for (const city of country.cities) {
        expect(facets.cities.get(city.key) ?? 0, `city ${city.key}`).toBe(
          view({ ...filters, countries: [], cities: [city.key] }).totalServices,
        );
      }
    }
    for (const providerId of [48, 46, 61, 105, 130, 146]) {
      expect(facets.providers.get(providerId) ?? 0, `provider ${providerId}`).toBe(
        view({ ...filters, providers: [providerId] }).totalServices,
      );
    }
    for (const currency of catalog.currencies) {
      expect(facets.currencies.get(currency) ?? 0, `currency ${currency}`).toBe(
        view({ ...filters, currency, priceMin: null, priceMax: null }).totalServices,
      );
    }
    expect(facets.homeTest, "home test").toBe(view({ ...filters, homeTest: true }).totalServices);
  }

  it("match brute force with no filters", () => {
    expectCountsMatchBruteForce({});
  });

  it("match brute force for the customer's story (Bangkok, check-ups, under THB 5,000)", () => {
    expectCountsMatchBruteForce({
      cities: ["TH.bangkok"],
      types: ["package"],
      currency: "THB",
      priceMax: 5000,
    });
  });

  it("match brute force across random multi-filter combinations", () => {
    const random = rng(42);
    const pick = <T>(values: readonly T[], max: number) =>
      values.filter(() => random() < max / values.length);
    for (let i = 0; i < 12; i++) {
      const currency = random() < 0.4 ? (pick(catalog.currencies, 1)[0] ?? null) : null;
      expectCountsMatchBruteForce({
        q: random() < 0.3 ? (["test", "check", "massage", "thyroid"][i % 4] ?? "") : "",
        types: pick(SERVICE_TYPES, 2),
        categories:
          random() < 0.3
            ? pick(
                catalog.categories.map((c) => c.key),
                2,
              )
            : [],
        providers: random() < 0.2 ? [48, 100, 130] : [],
        countries: pick(
          catalog.countries.map((c) => c.code),
          1,
        ),
        cities: random() < 0.3 ? ["TH.bangkok", "NP.kathmandu"] : [],
        currency,
        priceMin: currency && random() < 0.5 ? 500 : null,
        priceMax: currency && random() < 0.5 ? 6000 : null,
        homeTest: random() < 0.25,
      });
    }
  });

  it("keeps a selected option's count meaningful (it doesn't count itself out)", () => {
    const v = view({ types: ["lab_test"], cities: ["TH.bangkok"] });
    expect(v.facets.types.get("lab_test")).toBe(v.totalServices);
    // Other types show what selecting them *as well* would add
    expect(view({ types: ["lab_test", "package"], cities: ["TH.bangkok"] }).totalServices).toBe(
      v.totalServices + (v.facets.types.get("package") ?? 0),
    );
  });

  it("counts subcategories within the selected category", () => {
    const v = view({ categories: ["lab_test.blood-tests"] });
    const subTotal = ["diabetes", "thyroid", "lipid-profile", "vitamins"]
      .map((s) => v.facets.subcategories.get(`lab_test.blood-tests.${s}`) ?? 0)
      .reduce((a, b) => a + b, 0);
    // Some blood tests have no subcategory, so the parts can be less than the whole
    expect(subTotal).toBeLessThanOrEqual(v.totalServices);
    expect(
      view({
        categories: ["lab_test.blood-tests"],
        subcategories: ["lab_test.blood-tests.thyroid"],
      }).totalServices,
    ).toBe(v.facets.subcategories.get("lab_test.blood-tests.thyroid"));
  });
});

describe("the two 'ultrasound' categories", () => {
  it("are filtered independently", () => {
    const packages = allResults({ categories: ["package.ultrasound"] });
    const labTests = allResults({ categories: ["lab_test.ultrasound"] });
    expect(packages.flatMap((p) => p.services).every((s) => s.service.type === "package")).toBe(
      true,
    );
    expect(labTests.flatMap((p) => p.services).every((s) => s.service.type === "lab_test")).toBe(
      true,
    );
  });

  it("each have their own 'thyroid' subcategory", () => {
    const pkg = view({
      categories: ["package.ultrasound"],
      subcategories: ["package.ultrasound.thyroid"],
    });
    const lab = view({
      categories: ["lab_test.ultrasound"],
      subcategories: ["lab_test.ultrasound.thyroid"],
    });
    expect(pkg.totalServices).toBeGreaterThan(0);
    expect(lab.totalServices).toBeGreaterThan(0);
    const both = view({
      categories: ["package.ultrasound", "lab_test.ultrasound"],
      subcategories: ["package.ultrasound.thyroid"],
    });
    // Narrowing the package one doesn't narrow the lab-test one
    expect(both.totalServices).toBe(
      pkg.totalServices + view({ categories: ["lab_test.ultrasound"] }).totalServices,
    );
  });

  it("are both found by searching for 'ultrasound'", () => {
    const types = new Set(
      allResults({ q: "ultrasound" }).flatMap((p) => p.services.map((s) => s.service.type)),
    );
    expect(types).toEqual(new Set(["package", "lab_test"]));
  });
});

describe("price filter", () => {
  it("only ever returns services in the chosen currency, within the range", () => {
    const results = allResults({ currency: "THB", priceMin: 1000, priceMax: 5000 });
    expect(results.length).toBeGreaterThan(0);
    for (const provider of results) {
      expect(provider.provider.currency).toBe("THB");
      for (const s of provider.services) {
        expect(s.quote).not.toBeNull();
        expect(s.quote!.finalMinor).toBeGreaterThanOrEqual(100_000);
        expect(s.quote!.finalMinor).toBeLessThanOrEqual(500_000);
      }
    }
  });

  it("matches a wellness service when any duration fits, and headlines that duration", () => {
    const results = allResults({
      currency: "THB",
      priceMin: 2000,
      priceMax: 2100,
      types: ["wellness"],
    });
    const facial = results
      .flatMap((p) => p.services)
      .find((s) => s.service.id === "5f0c1a52-6b1e-4c1f-9a51-000000000003");
    // 60 min costs 1,800 (out of range); 90 min costs 2,040 (in range)
    expect(facial?.quote?.durationMinutes).toBe(90);
    expect(facial?.matchingOptionCount).toBe(1);
  });

  it("includes free services from 0 and excludes services without a trustworthy price", () => {
    const ids = (f: Partial<ExplorerFilters>) =>
      allResults(f).flatMap((p) => p.services.map((s) => s.service.id));
    expect(ids({ currency: "THB", priceMin: 0, priceMax: 0 })).toContain(FREE_DENTAL_ID);
    expect(ids({ currency: "THB", priceMax: 100_000 })).not.toContain(VITAMIN_D_ID);
    // Choosing the currency alone doesn't hide it: it *is* a THB service
    expect(ids({ currency: "THB" })).toContain(VITAMIN_D_ID);
  });

  it("compares against the displayed (rounded) price, so the filter agrees with the screen", () => {
    for (const provider of allResults({ currency: "INR", priceMax: 2455 })) {
      for (const s of provider.services) expect(s.quote!.finalMinor).toBeLessThanOrEqual(245_500);
    }
  });
});

describe("sorting", () => {
  it("sorts by price within each currency and never interleaves currencies", () => {
    const results = allResults({ sort: "price-asc" });
    const currencies = results.map((p) => p.provider.currency);
    const order = [...new Set(currencies)];
    expect(order).toHaveLength(3);
    // Contiguous blocks, largest currency group first
    expect(currencies).toEqual([...currencies].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
    for (const currency of order) {
      const prices = results
        .filter((p) => p.provider.currency === currency && p.leadPriceMinor !== null)
        .map((p) => p.leadPriceMinor!);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    }
  });

  it("sorts high to low with unpriced services last", () => {
    const results = allResults({ sort: "price-desc", currency: "THB" });
    const prices = results.map((p) => p.leadPriceMinor);
    const priced = prices.filter((p): p is number => p !== null);
    expect(priced).toEqual([...priced].sort((a, b) => b - a));
    const riverside = results.find((p) => p.provider.id === 48);
    expect(riverside?.services.at(-1)?.service.id).toBe(VITAMIN_D_ID);
  });

  it("puts unrated providers after rated ones when sorting by rating", () => {
    const ratings = allResults({ sort: "rating" }).map((p) => p.provider.rating);
    const firstUnrated = ratings.indexOf(null);
    expect(firstUnrated).toBeGreaterThan(0);
    expect(ratings.slice(firstUnrated).every((r) => r === null)).toBe(true);
    const rated = ratings.slice(0, firstUnrated) as number[];
    expect(rated).toEqual([...rated].sort((a, b) => b - a));
  });

  it("ranks title matches above provider-name-only matches for 'Best match'", () => {
    const [top] = view({ q: "thyroid" }).providers;
    expect(top?.services[0]?.service.title.toLowerCase()).toContain("thyroid");
  });
});

describe("search", () => {
  it("finds the messy 'hba1c TEST' title regardless of case and spacing", () => {
    const ids = allResults({ q: "  HbA1c   test " }).flatMap((p) =>
      p.services.map((s) => s.service.id),
    );
    expect(ids).toContain("5f0c1a52-6b1e-4c1f-9a51-000000000007");
  });

  it("treats check-up, check up and checkup alike", () => {
    const a = view({ q: "check-up" }).totalServices;
    expect(a).toBeGreaterThan(0);
    expect(view({ q: "checkup" }).totalServices).toBe(a);
  });

  it("matches word prefixes, not arbitrary substrings", () => {
    expect(view({ q: "thyr" }).totalServices).toBeGreaterThan(0);
    expect(view({ q: "hyroid" }).totalServices).toBe(0);
  });

  it("searches provider names and categories", () => {
    const riverside = allResults({ q: "riverside" });
    expect(riverside.some((p) => p.provider.id === 48)).toBe(true);
    expect(view({ q: "genetic" }).totalServices).toBeGreaterThan(0); // category title
  });
});

describe("empty-state suggestions", () => {
  it("report how many results removing each facet would give", () => {
    const filters: Partial<ExplorerFilters> = {
      types: ["insurance"],
      cities: ["NP.pokhara"],
      homeTest: true,
    };
    const v = view(filters);
    expect(v.totalServices).toBe(0);
    for (const facet of ["type", "location", "homeTest"] as FacetId[]) {
      expect(v.withoutFacet[facet], facet).toBe(
        computeView(index, clearFacet({ ...DEFAULT_FILTERS, ...filters }, facet)).totalServices,
      );
    }
  });
});

describe("pagination", () => {
  it("pages providers and clamps out-of-range pages", () => {
    const first = view({});
    expect(first.providers).toHaveLength(PROVIDERS_PER_PAGE);
    // 65 active providers, but one has nothing a customer may see
    expect(first.totalProviders).toBe(catalog.providerList.length);
    expect(first.totalProviders).toBe(64);
    const last = view({ page: 999 });
    expect(last.page).toBe(first.totalPages);
    expect(last.providers.length).toBeGreaterThan(0);
  });

  it("shows every matching service count per provider, not just the first three", () => {
    const riverside = allResults({ providers: [48] })[0];
    expect(riverside?.services.length).toBe(view({ providers: [48] }).totalServices);
  });
});
