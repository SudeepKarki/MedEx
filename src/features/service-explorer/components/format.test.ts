import { describe, expect, it } from "vitest";
import { computeQuote, type RawPriceFields } from "../domain/pricing";
import { discountLabel } from "./format";

function quote(fields: RawPriceFields) {
  const result = computeQuote(fields);
  if (!result.ok) throw new Error(`expected a price, got ${result.reason}`);
  return result.quote;
}
const fields = (overrides: Partial<RawPriceFields>): RawPriceFields => ({
  price: "5960.00",
  discount: "30.00",
  discountType: "percent",
  serviceCharge: "0.00",
  serviceChargeType: "amount",
  ...overrides,
});

describe("discountLabel agrees with the two prices on screen", () => {
  it("a percentage when the prices are that far apart, with or without a percentage charge", () => {
    expect(discountLabel(quote(fields({})), "THB")).toBe("30% off");
    expect(
      discountLabel(quote(fields({ serviceCharge: "7.00", serviceChargeType: "percent" })), "THB"),
    ).toBe("30% off");
  });

  it("the amount when a fixed charge changes the percentage (Flu Vaccine Session)", () => {
    // 5,960 − 30% + 233 = 4,405, struck through at 5,960 + 233 = 6,193: 28.9% apart
    const q = quote(fields({ serviceCharge: "233.00" }));
    expect(discountLabel(q, "THB")).toBe("THB\u00a01,788.00 off");
  });

  it("an amount discount with a percentage charge is the difference as shown", () => {
    // 600 off 3,500 with a 10% charge: 3,850.00 struck, 3,190.00 paid
    const q = quote(
      fields({
        price: "3500.00",
        discount: "600.00",
        discountType: "amount",
        serviceCharge: "10.00",
        serviceChargeType: "percent",
      }),
    );
    expect(discountLabel(q, "THB")).toBe("THB\u00a0660.00 off");
  });
});
