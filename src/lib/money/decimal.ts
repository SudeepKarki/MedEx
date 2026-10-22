import Big from "big.js";

/**
 * Exact decimal arithmetic for money.
 *
 * The API sends money as decimal strings ("6200.00"). JavaScript numbers can't
 * represent most of those exactly (0.1 + 0.2 !== 0.3), and the domain rules say
 * "round only for display, never in the middle of a calculation". So every
 * calculation runs on Big (arbitrary-precision decimal) and only the final
 * display step rounds, half-up, to 2 places.
 */
export type Decimal = Big;

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

/**
 * Parse a money-like value from the API. Accepts decimal strings and finite
 * numbers; anything else (null, "", "abc", "1,200.00", NaN) returns null so the
 * caller has to decide what an unknown amount means instead of getting 0.
 */
export function parseDecimal(value: unknown): Decimal | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? new Big(value) : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!DECIMAL_PATTERN.test(trimmed)) return null;
  return new Big(trimmed);
}

export function decimal(value: string | number): Decimal {
  return new Big(value);
}

export const ZERO: Decimal = new Big(0);

/** Round half-up to `dp` places. Use for display and display-equivalent comparisons only. */
export function roundHalfUp(value: Decimal, dp = 2): Decimal {
  return value.round(dp, Big.roundHalfUp);
}

/**
 * Integer minor units (e.g. satang, paisa) of the *displayed* amount. Useful for
 * comparing and sorting with plain numbers while staying consistent with what the
 * customer sees on screen.
 */
export function toDisplayMinorUnits(value: Decimal): number {
  return Number(roundHalfUp(value, 2).times(100).toFixed(0));
}
