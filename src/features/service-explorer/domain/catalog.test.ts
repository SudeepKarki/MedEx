import { describe, expect, it } from "vitest";
import {
  DISABLED_THYROID_ID,
  FREE_DENTAL_ID,
  MESSY_TITLE_ID,
  SIGNATURE_FACIAL_ID,
  VITAMIN_D_ID,
  fixtureCatalog,
} from "../test/fixture";
import { buildCatalog } from "./catalog";

const catalog = fixtureCatalog();
const byId = (id: string) => catalog.services.find((s) => s.id === id);

describe("buildCatalog with the assessment data", () => {
  it("applies all three visibility rules", () => {
    // 3,200 services − 198 switched off − 103 live ones at 2 inactive providers
    // − 46 in the inactive "Seasonal Offers" category
    expect(catalog.services).toHaveLength(2853);
    expect(byId(DISABLED_THYROID_ID)).toBeUndefined();
    expect(catalog.services.some((s) => [161, 162].includes(s.providerId))).toBe(false);
    expect(catalog.categories.some((c) => c.slug === "seasonal-offers")).toBe(false);
  });

  it("keeps services with no category (the rule applies only if they have one)", () => {
    // 22 in the file; 2 of them belong to inactive providers
    expect(catalog.services.filter((s) => s.categoryKey === null)).toHaveLength(20);
  });

  it("keys categories by type, so the two 'ultrasound' categories stay separate", () => {
    const ultrasound = catalog.categories.filter((c) => c.slug === "ultrasound");
    expect(ultrasound.map((c) => c.key).sort()).toEqual([
      "lab_test.ultrasound",
      "package.ultrasound",
    ]);
    // "thyroid" is a child of three different parents
    const thyroidKeys = [...catalog.subcategoriesByKey.keys()].filter((k) =>
      k.endsWith(".thyroid"),
    );
    expect(thyroidKeys.sort()).toEqual([
      "lab_test.blood-tests.thyroid",
      "lab_test.ultrasound.thyroid",
      "package.ultrasound.thyroid",
    ]);
  });

  it("refuses to show a negative price for the discount-larger-than-price service", () => {
    const vitaminD = byId(VITAMIN_D_ID);
    expect(vitaminD?.pricing).toEqual({ kind: "unavailable", reason: "invalid-price" });
    expect(catalog.issues.some((i) => i.code === "negative-price" && i.id === VITAMIN_D_ID)).toBe(
      true,
    );
  });

  it("treats a 0.00 price as free, not as unknown", () => {
    const dental = byId(FREE_DENTAL_ID);
    expect(dental?.pricing.kind).toBe("fixed");
    if (dental?.pricing.kind === "fixed") expect(dental.pricing.quote.final.toString()).toBe("0");
  });

  it("cleans stray whitespace from titles but keeps the provider's casing", () => {
    expect(byId(MESSY_TITLE_ID)?.title).toBe("hba1c TEST (Diabetes)");
    expect(catalog.issues.some((i) => i.code === "title-whitespace")).toBe(true);
  });

  it("prices wellness services per duration, sorted, never as a single price", () => {
    const facial = byId(SIGNATURE_FACIAL_ID);
    expect(facial?.pricing.kind).toBe("options");
    if (facial?.pricing.kind !== "options") return;
    expect(facial.pricing.options.map((o) => o.durationMinutes)).toEqual([60, 90]);
    expect(facial.pricing.options.map((o) => o.final.toString())).toEqual(["1800", "2040"]);
  });

  it("represents providers without reviews as unrated, not as 0 stars", () => {
    const unrated = [...catalog.providers.values()].filter((p) => p.rating === null);
    expect(unrated.map((p) => p.id).sort((a, b) => a - b)).toEqual([61, 105, 122, 139, 156]);
    // ...and gives them the marketplace average for relevance
    const rated = [...catalog.providers.values()].filter((p) => p.rating !== null);
    const mean = rated.reduce((sum, p) => sum + p.rating!, 0) / rated.length;
    expect(unrated[0]?.bayesianRating).toBeCloseTo(mean);
  });

  it("only lists places and currencies that have something to show", () => {
    expect(catalog.currencies).toEqual(["INR", "NPR", "THB"]);
    expect(catalog.countries.map((c) => c.code)).toEqual(["IN", "NP", "TH"]);
  });
});

describe("buildCatalog with malformed records", () => {
  it("skips unreadable records and reports them instead of failing", () => {
    const result = buildCatalog({
      categories: [{ nonsense: true }],
      providers: [
        {
          id: 1,
          name: " Clinic ",
          status: "active",
          providerInformation: { currency: "thb", rating: 7, reviewCount: 3 },
        },
      ],
      services: [
        null,
        {
          id: "a",
          title: "X",
          slug: "x",
          type: "spaceship",
          userId: 1,
          status: true,
        },
        {
          id: "b",
          title: "Y",
          slug: "y",
          type: "lab_test",
          userId: 1,
          status: true,
          categoryId: "missing",
          price: "1.00",
        },
        {
          id: "c",
          title: "Z",
          slug: "z",
          type: "wellness",
          userId: 1,
          status: true,
          price: null,
          wellnessPricing: [],
        },
      ],
    });
    expect(result.services.map((s) => s.id)).toEqual(["c"]);
    expect(result.services[0]?.pricing).toEqual({ kind: "unavailable", reason: "no-options" });
    expect(result.providers.get(1)?.rating).toBeNull(); // 7 stars is out of range
    expect(result.providers.get(1)?.currency).toBe("THB");
    const codes = result.issues.map((i) => i.code);
    expect(codes).toEqual(
      expect.arrayContaining(["invalid-record", "category-unknown", "no-wellness-options"]),
    );
  });
});
