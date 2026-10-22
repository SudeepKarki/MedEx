import { ZERO, parseDecimal, toDisplayMinorUnits, type Decimal } from "@/lib/money";
import type { PriceQuote } from "./types";

/** The price fields as the API sends them (decimal strings, or null). */
export interface RawPriceFields {
  price?: unknown;
  discount?: unknown;
  discountType?: unknown;
  serviceCharge?: unknown;
  serviceChargeType?: unknown;
}

export type QuoteResult =
  | { ok: true; quote: PriceQuote }
  | { ok: false; reason: "unparseable" | "negative"; detail: string };

type Kind = "percent" | "amount";

function parseKind(value: unknown, amount: Decimal): Kind | null | "invalid" {
  if (value === "percent" || value === "amount") return value;
  // A missing type is only harmless when there is nothing to apply.
  if (value === null || value === undefined) return amount.eq(0) ? null : "invalid";
  return "invalid";
}

/**
 * The MedEx final-price formula, computed exactly:
 *
 *   discountAmount = percent ? price × discount / 100 : discount
 *   afterDiscount  = price − discountAmount
 *   chargeAmount   = percent ? afterDiscount × serviceCharge / 100 : serviceCharge
 *   finalPrice     = afterDiscount + chargeAmount
 *
 * Returns an error instead of a number whenever the inputs can't produce a
 * price we'd stand behind (unparseable values, negative amounts, a discount
 * bigger than the price).
 */
export function computeQuote(
  fields: RawPriceFields,
  option: { optionId: string | null; durationMinutes: number | null } = {
    optionId: null,
    durationMinutes: null,
  },
): QuoteResult {
  const price = parseDecimal(fields.price);
  const discount = fields.discount == null ? ZERO : parseDecimal(fields.discount);
  const charge = fields.serviceCharge == null ? ZERO : parseDecimal(fields.serviceCharge);
  if (!price || !discount || !charge) {
    return {
      ok: false,
      reason: "unparseable",
      detail: "price, discount or charge is not a number",
    };
  }
  const discountKind = parseKind(fields.discountType, discount);
  const chargeKind = parseKind(fields.serviceChargeType, charge);
  if (discountKind === "invalid" || chargeKind === "invalid") {
    return { ok: false, reason: "unparseable", detail: "unknown discount or charge type" };
  }
  if (price.lt(0) || discount.lt(0) || charge.lt(0)) {
    return { ok: false, reason: "negative", detail: "negative price, discount or charge" };
  }

  const discountAmount = discountKind === "percent" ? price.times(discount).div(100) : discount;
  const afterDiscount = price.minus(discountAmount);
  if (afterDiscount.lt(0)) {
    return {
      ok: false,
      reason: "negative",
      detail: `discount ${discount.toFixed(2)}${discountKind === "percent" ? "%" : ""} exceeds price ${price.toFixed(2)}`,
    };
  }
  const chargeAmount = chargeKind === "percent" ? afterDiscount.times(charge).div(100) : charge;
  const final = afterDiscount.plus(chargeAmount);
  const chargeOnList = chargeKind === "percent" ? price.times(charge).div(100) : charge;

  return {
    ok: true,
    quote: {
      optionId: option.optionId,
      durationMinutes: option.durationMinutes,
      listPrice: price,
      discountAmount,
      chargeAmount,
      final,
      withoutDiscount: price.plus(chargeOnList),
      discount: discountAmount.gt(0)
        ? discountKind === "percent"
          ? { kind: "percent", percent: discount }
          : { kind: "amount" }
        : null,
      charge: chargeAmount.gt(0)
        ? chargeKind === "percent"
          ? { kind: "percent", percent: charge }
          : { kind: "amount" }
        : null,
      finalMinor: toDisplayMinorUnits(final),
    },
  };
}
