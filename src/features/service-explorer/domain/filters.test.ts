import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, toggleCity, toggleCountry } from "./filters";

const thailand = ["TH.bangkok", "TH.chiang-mai", "TH.pattaya", "TH.phuket"];

describe("location tree", () => {
  it("checking a country absorbs its individually checked cities", () => {
    const next = toggleCountry({ ...DEFAULT_FILTERS, cities: ["TH.bangkok", "NP.pokhara"] }, "TH");
    expect(next.countries).toEqual(["TH"]);
    expect(next.cities).toEqual(["NP.pokhara"]);
  });

  it("unchecking one city of a checked country keeps the others", () => {
    const next = toggleCity({ ...DEFAULT_FILTERS, countries: ["TH"] }, "TH.bangkok", thailand);
    expect(next.countries).toEqual([]);
    expect(next.cities.sort()).toEqual(["TH.chiang-mai", "TH.pattaya", "TH.phuket"]);
  });

  it("unchecking a city works even if the link listed it next to its country", () => {
    const next = toggleCity(
      { ...DEFAULT_FILTERS, countries: ["TH"], cities: ["TH.bangkok"] },
      "TH.bangkok",
      thailand,
    );
    expect(next.cities).not.toContain("TH.bangkok");
  });

  it("checking every city collapses into the country", () => {
    let f = { ...DEFAULT_FILTERS };
    for (const city of thailand) f = toggleCity(f, city, thailand);
    expect(f.countries).toEqual(["TH"]);
    expect(f.cities).toEqual([]);
  });
});
