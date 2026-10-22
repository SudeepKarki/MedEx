import { describe, expect, it } from "vitest";
import {
  decimal,
  formatMoney,
  normaliseCurrencyCode,
  parseDecimal,
  roundHalfUp,
  sumByCurrency,
  toDisplayMinorUnits,
} from ".";

describe("parseDecimal", () => {
  it("parses API decimal strings exactly", () => {
    expect(parseDecimal("6200.00")?.toString()).toBe("6200");
    expect(parseDecimal(" 12.50 ")?.toString()).toBe("12.5");
    expect(parseDecimal(450)?.toString()).toBe("450");
  });

  it("returns null instead of 0 for anything that is not a number", () => {
    for (const value of [null, undefined, "", "abc", "1,200.00", "12.", Number.NaN, {}]) {
      expect(parseDecimal(value)).toBeNull();
    }
  });
});

describe("rounding", () => {
  it("rounds half-up only at the end, without float drift", () => {
    // 1.005 and 5970.605 have no exact binary representation, so floats round them down
    expect((1.005).toFixed(2)).toBe("1.00");
    expect((5970.605).toFixed(2)).toBe("5970.60");
    expect(roundHalfUp(decimal("1.005")).toFixed(2)).toBe("1.01");
    expect(roundHalfUp(decimal("5970.605")).toFixed(2)).toBe("5970.61");
    expect(roundHalfUp(decimal("10899.975")).toFixed(2)).toBe("10899.98");
    expect(roundHalfUp(decimal("5497.125")).toFixed(2)).toBe("5497.13");
  });

  it("converts the displayed amount to integer minor units", () => {
    expect(toDisplayMinorUnits(decimal("5970.6"))).toBe(597060);
    expect(toDisplayMinorUnits(decimal("10899.975"))).toBe(1089998);
  });
});

describe("formatMoney", () => {
  // Intl puts a no-break space between the code and the amount
  const nbsp = "\u00a0";

  it("uses the ISO code so NPR and INR are never confused", () => {
    expect(formatMoney(decimal("5970.6"), "THB")).toBe(`THB${nbsp}5,970.60`);
    expect(formatMoney(decimal("1800"), "NPR")).toBe(`NPR${nbsp}1,800.00`);
    expect(formatMoney(decimal("10899.975"), "INR")).toBe(`INR${nbsp}10,899.98`);
    expect(formatMoney(decimal("5970.605"), "THB")).toBe(`THB${nbsp}5,970.61`);
  });
});

describe("sumByCurrency", () => {
  it("never mixes currencies", () => {
    const totals = sumByCurrency([
      { currency: "THB", amount: decimal("100.10") },
      { currency: "NPR", amount: decimal("200") },
      { currency: "THB", amount: decimal("0.20") },
    ]);
    expect(totals.get("THB")?.toString()).toBe("100.3");
    expect(totals.get("NPR")?.toString()).toBe("200");
    expect(totals.size).toBe(2);
  });
});

describe("normaliseCurrencyCode", () => {
  it("accepts ISO-like codes and rejects junk", () => {
    expect(normaliseCurrencyCode(" thb ")).toBe("THB");
    expect(normaliseCurrencyCode("BAHT")).toBeNull();
    expect(normaliseCurrencyCode(null)).toBeNull();
  });
});
