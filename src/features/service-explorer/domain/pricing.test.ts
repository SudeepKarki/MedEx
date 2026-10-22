import { describe, expect, it } from "vitest";
import { computeQuote, type RawPriceFields } from "./pricing";

const base: RawPriceFields = {
  price: "6200.00",
  discount: "10.00",
  discountType: "percent",
  serviceCharge: "7.00",
  serviceChargeType: "percent",
};

function quote(fields: Partial<RawPriceFields>) {
  const result = computeQuote({ ...base, ...fields });
  if (!result.ok) throw new Error(`expected a price, got ${result.reason}`);
  return result.quote;
}

describe("computeQuote", () => {
  it("applies the brief's formula: percent discount, then percent charge on the discounted price", () => {
    const q = quote({});
    expect(q.discountAmount.toString()).toBe("620");
    expect(q.chargeAmount.toString()).toBe("390.6"); // 7% of 5580, not of 6200
    expect(q.final.toString()).toBe("5970.6");
    expect(q.finalMinor).toBe(597060);
  });

  it("handles amount discounts and amount charges", () => {
    const q = quote({
      price: "3500.00",
      discount: "500.00",
      discountType: "amount",
      serviceCharge: "120.00",
      serviceChargeType: "amount",
    });
    expect(q.final.toString()).toBe("3120");
    expect(q.discount).toEqual({ kind: "amount" });
  });

  it("never rounds mid-calculation", () => {
    // 12.5% off 4365.00 = 545.625; then 3% charge on 3819.375 = 114.58125
    const q = quote({ price: "4365.00", discount: "12.50", serviceCharge: "3.00" });
    expect(q.final.toString()).toBe("3933.95625");
    expect(q.finalMinor).toBe(393396);
  });

  it("compares like with like: the struck-through price includes the charge too", () => {
    // Without this, a 5% discount plus a fixed charge would show the
    // "original" 8,760 struck through next to a higher final 8,934.
    const q = quote({
      price: "8760.00",
      discount: "5.00",
      serviceCharge: "612.00",
      serviceChargeType: "amount",
    });
    expect(q.final.toString()).toBe("8934");
    expect(q.withoutDiscount.toString()).toBe("9372");
    expect(q.withoutDiscount.gt(q.final)).toBe(true);
  });

  it("treats a zero price as free, not as missing", () => {
    const q = quote({
      price: "0.00",
      discount: "0.00",
      discountType: "amount",
      serviceCharge: "0.00",
    });
    expect(q.final.toString()).toBe("0");
    expect(q.discount).toBeNull();
  });

  it("rejects a discount larger than the price instead of showing a negative price", () => {
    const result = computeQuote({
      ...base,
      price: "450.00",
      discount: "600.00",
      discountType: "amount",
      serviceCharge: "0.00",
      serviceChargeType: "amount",
    });
    expect(result).toMatchObject({ ok: false, reason: "negative" });
  });

  it("rejects percent discounts over 100% and negative inputs", () => {
    expect(computeQuote({ ...base, discount: "120.00" }).ok).toBe(false);
    expect(computeQuote({ ...base, serviceCharge: "-5.00" }).ok).toBe(false);
  });

  it("rejects values it can't parse rather than treating them as zero", () => {
    expect(computeQuote({ ...base, price: null }).ok).toBe(false);
    expect(computeQuote({ ...base, price: "6,200.00" }).ok).toBe(false);
    expect(computeQuote({ ...base, discountType: "fixed" }).ok).toBe(false);
  });

  it("allows a missing type only when the amount is zero", () => {
    expect(computeQuote({ ...base, discount: "0.00", discountType: null }).ok).toBe(true);
    expect(computeQuote({ ...base, discount: "10.00", discountType: null }).ok).toBe(false);
  });
});
