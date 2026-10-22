import type { CatalogProduct } from "./types";

/**
 * Business rules the server enforces (the client only learns them from a
 * 409, the way it would with a real API).
 */
export const MAX_QUANTITY = 10;

export function maxQuantityFor(product: CatalogProduct): number {
  // One insurance plan per order: a second copy of the same plan is never intended.
  return product.type === "insurance" ? 1 : MAX_QUANTITY;
}

export function quantityLimitMessage(product: CatalogProduct, max: number): string {
  return product.type === "insurance"
    ? `You can add ${product.title} once per order.`
    : `You can book at most ${max} of ${product.title} in one order.`;
}

/** Final unit price in minor units, or null while a wellness duration isn't chosen. */
export function unitPriceMinor(
  product: CatalogProduct,
  wellnessPricingId: string | null,
): number | null {
  if (product.wellnessPricing?.length) {
    const option = product.wellnessPricing.find((o) => o.id === wellnessPricingId);
    return option ? Math.round(option.amount_after_service_charge * 100) : null;
  }
  return product.price === null ? null : Math.round(product.price * 100);
}

export function durationFor(
  product: CatalogProduct,
  wellnessPricingId: string | null,
): number | null {
  return (
    product.wellnessPricing?.find((o) => o.id === wellnessPricingId)?.durationInMinutes ?? null
  );
}
