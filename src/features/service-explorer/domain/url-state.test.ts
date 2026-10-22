import { describe, expect, it } from "vitest";
import { fixtureCatalog } from "../test/fixture";
import { DEFAULT_FILTERS } from "./filters";
import { parseFilters, sanitizeFilters, serializeFilters } from "./url-state";

const parse = (query: string) => parseFilters(new URLSearchParams(query));

describe("URL state", () => {
  it("round-trips every filter, the sort and the page", () => {
    const query =
      "q=check+up&type=package,lab_test&category=package.ultrasound&sub=package.ultrasound.thyroid" +
      "&provider=48,100&country=NP&city=TH.bangkok&currency=THB&min=100&max=5000&home=1&sort=price-asc&page=3";
    const filters = parse(query);
    expect(filters).toMatchObject({
      q: "check up",
      types: ["package", "lab_test"],
      categories: ["package.ultrasound"],
      subcategories: ["package.ultrasound.thyroid"],
      providers: [48, 100],
      countries: ["NP"],
      cities: ["TH.bangkok"],
      currency: "THB",
      priceMin: 100,
      priceMax: 5000,
      homeTest: true,
      sort: "price-asc",
      page: 3,
    });
    expect(parse(serializeFilters(filters))).toEqual(filters);
  });

  it("is canonical: the same view always gives the same URL", () => {
    const a = serializeFilters(
      parse("type=lab_test,package&provider=100,48,48&page=1&sort=relevance"),
    );
    const b = serializeFilters(parse("provider=48,100&type=package,lab_test"));
    expect(a).toBe(b);
    expect(a).toBe("type=package,lab_test&provider=48,100");
    expect(serializeFilters(DEFAULT_FILTERS)).toBe("");
  });

  it("drops anything malformed instead of throwing", () => {
    const filters = parse(
      "type=spaceship,lab_test&provider=abc,-4,0,7&country=Thailand,np&currency=baht&min=10&sort=cheapest&page=-2&home=yes",
    );
    expect(filters).toMatchObject({
      types: ["lab_test"],
      providers: [7],
      countries: ["NP"],
      currency: null,
      priceMin: null, // a price bound without a currency means nothing
      sort: "relevance",
      page: 1,
      homeTest: false,
    });
  });

  it("swaps an inverted price range", () => {
    expect(parse("currency=THB&min=5000&max=100")).toMatchObject({ priceMin: 100, priceMax: 5000 });
  });

  it("ignores a subcategory whose parent category isn't selected", () => {
    expect(parse("sub=package.ultrasound.thyroid").subcategories).toEqual([]);
  });

  it("encodes free text safely", () => {
    const query = serializeFilters({ ...DEFAULT_FILTERS, q: "a&b=c, d" });
    expect(parse(query).q).toBe("a&b=c, d");
  });
});

describe("sanitizeFilters", () => {
  it("removes values that don't exist in the catalog and says which", () => {
    const { filters, dropped } = sanitizeFilters(
      parse(
        "provider=48,99999&category=package.nope,lab_test.ultrasound&city=TH.atlantis&currency=USD&max=10",
      ),
      fixtureCatalog(),
    );
    expect(filters.providers).toEqual([48]);
    expect(filters.categories).toEqual(["lab_test.ultrasound"]);
    expect(filters.cities).toEqual([]);
    expect(filters.currency).toBeNull();
    expect(filters.priceMax).toBeNull();
    expect(dropped).toHaveLength(4);
  });
});
