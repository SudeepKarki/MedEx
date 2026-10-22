/**
 * Currencies the marketplace currently prices in. Currency always belongs to the
 * provider; there are no exchange rates anywhere in the system, so amounts in
 * different currencies are never added, compared or converted.
 */
export const KNOWN_CURRENCIES = ["THB", "NPR", "INR"] as const;
export type KnownCurrency = (typeof KNOWN_CURRENCIES)[number];

/** ISO 4217 code. Typed as string so a new provider currency doesn't crash the UI. */
export type CurrencyCode = string;

const CURRENCY_NAMES: Record<KnownCurrency, string> = {
  THB: "Thai baht",
  NPR: "Nepalese rupee",
  INR: "Indian rupee",
};

export function isKnownCurrency(code: string): code is KnownCurrency {
  return (KNOWN_CURRENCIES as readonly string[]).includes(code);
}

export function normaliseCurrencyCode(value: unknown): CurrencyCode | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

export function currencyName(code: CurrencyCode): string {
  return isKnownCurrency(code) ? CURRENCY_NAMES[code] : code;
}
