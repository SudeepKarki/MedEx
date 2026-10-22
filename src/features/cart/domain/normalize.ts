import { decimal, normaliseCurrencyCode } from "@/lib/money";
import { productSchema, type RawCart, type RawProduct } from "../api/schemas";
import type { Cart, CartLine, CartProduct } from "./types";

export function toProduct(raw: RawProduct): CartProduct | null {
  const currency = normaliseCurrencyCode(raw.currency);
  if (!currency) return null;
  return {
    id: raw.id,
    title: raw.title.replace(/\s+/g, " ").trim(),
    type: raw.type,
    currency,
    providerId: raw.providerId,
    providerName: raw.providerName,
    price: raw.price === null || raw.wellnessPricing?.length ? null : decimal(raw.price),
    wellnessOptions: (raw.wellnessPricing ?? [])
      .map((o) => ({
        id: o.id,
        durationMinutes: o.durationInMinutes,
        price: decimal(o.amount_after_service_charge),
      }))
      .sort((a, b) => a.durationMinutes - b.durationMinutes),
  };
}

/**
 * GET /cart → the client's cart. Lines keep the server's grouping order; a
 * product that is `{}` or unreadable becomes `null` ("no longer available").
 * The server's itemCount/subtotals are not trusted for display: the client
 * recomputes them from the lines it shows, so they always agree with edits
 * that are still being saved.
 */
export function normalizeCart(raw: RawCart): Cart {
  const lines: CartLine[] = [];
  const groupTypes: string[] = [];
  for (const group of raw.groups) {
    for (const item of group.items) {
      const parsed = productSchema.safeParse(item.product);
      const product = parsed.success ? toProduct(parsed.data) : null;
      const type = product?.type ?? "unknown";
      if (!groupTypes.includes(type)) groupTypes.push(type);
      lines.push({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        wellnessPricingId: item.wellnessPricingId ?? null,
        product,
      });
    }
  }
  return { revision: raw.revision, groupTypes, lines };
}
