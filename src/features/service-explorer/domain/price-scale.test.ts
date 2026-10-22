import { describe, expect, it } from "vitest";
import { niceCeil, priceScale } from "./price-scale";

describe("price scale", () => {
  it("rounds the slider maximum up to a nice number", () => {
    expect(niceCeil(24_950)).toBe(25_000);
    expect(niceCeil(94_410)).toBe(100_000);
    expect(niceCeil(5_000)).toBe(5_000);
    expect(niceCeil(1_201)).toBe(2_000);
  });

  it("buckets every sample, including the most expensive", () => {
    const scale = priceScale([0, 50_000, 2_495_000], 10);
    expect(scale.max).toBe(25_000);
    expect(scale.histogram.reduce((a, b) => a + b, 0)).toBe(3);
    expect(scale.histogram[9]).toBe(1);
  });

  it("copes with no samples", () => {
    expect(priceScale([]).max).toBe(100);
  });
});
