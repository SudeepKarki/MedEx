import { durationFor, maxQuantityFor } from "./rules";
import type { CatalogProduct, GuestCartItem, ServerLine } from "./types";

/**
 * What POST /cart/merge reports back, one entry per thing the customer should
 * know about. Designed to be rendered as plain sentences.
 */
export type MergeChange =
  | {
      kind: "added";
      productId: string;
      title: string;
      quantity: number;
      durationMinutes: number | null;
    }
  | { kind: "quantity_raised"; productId: string; title: string; from: number; to: number }
  | {
      kind: "already_in_cart";
      productId: string;
      title: string;
      quantity: number;
      deviceQuantity: number;
    }
  | { kind: "duration_applied"; productId: string; title: string; durationMinutes: number }
  | {
      kind: "duration_kept";
      productId: string;
      title: string;
      keptMinutes: number;
      deviceMinutes: number;
    }
  | { kind: "quantity_limited"; productId: string; title: string; requested: number; to: number }
  | { kind: "not_available"; productId: string; quantity: number };

export interface MergeResult {
  lines: ServerLine[];
  changes: MergeChange[];
}

/**
 * Merges a guest's device cart into the account cart.
 *
 * Policy (see README › Guest cart):
 * - Same product in both: keep the **larger** quantity, never the sum. The
 *   guest most likely added the same test again on this device; doubling a
 *   booking is the expensive mistake, a missing extra one is easy to fix.
 * - A wellness duration chosen on the device fills one the account is
 *   missing; if both chose different durations, the account's choice wins
 *   and the customer is told which one was ignored.
 * - Products that no longer exist are skipped and reported.
 * - Quantities are capped by the same limits as PATCH.
 *
 * Because "keep the larger" is idempotent, sending the same merge twice (a
 * retry after a lost response) changes nothing the second time.
 */
export function mergeGuestCart(
  accountLines: readonly ServerLine[],
  guestItems: readonly GuestCartItem[],
  catalog: ReadonlyMap<string, CatalogProduct>,
  newLineId: () => string,
): MergeResult {
  const lines = accountLines.map((l) => ({ ...l }));
  const changes: MergeChange[] = [];

  for (const item of combineDuplicates(guestItems)) {
    const product = catalog.get(item.productId);
    if (!product) {
      changes.push({ kind: "not_available", productId: item.productId, quantity: item.quantity });
      continue;
    }

    const max = maxQuantityFor(product);
    const wanted = Math.max(1, Math.floor(item.quantity));
    const deviceDuration = durationFor(product, item.wellnessPricingId ?? null);
    const deviceOptionId = deviceDuration === null ? null : (item.wellnessPricingId ?? null);
    const existing = lines.find((l) => l.productId === item.productId);

    if (!existing) {
      const quantity = Math.min(wanted, max);
      lines.push({
        id: newLineId(),
        productId: product.id,
        quantity,
        wellnessPricingId: deviceOptionId,
      });
      changes.push({
        kind: "added",
        productId: product.id,
        title: product.title,
        quantity,
        durationMinutes: deviceDuration,
      });
      if (quantity < wanted) {
        changes.push({
          kind: "quantity_limited",
          productId: product.id,
          title: product.title,
          requested: wanted,
          to: quantity,
        });
      }
      continue;
    }

    if (wanted > existing.quantity) {
      const to = Math.min(wanted, max);
      if (to > existing.quantity) {
        changes.push({
          kind: "quantity_raised",
          productId: product.id,
          title: product.title,
          from: existing.quantity,
          to,
        });
        existing.quantity = to;
      }
      if (to < wanted) {
        changes.push({
          kind: "quantity_limited",
          productId: product.id,
          title: product.title,
          requested: wanted,
          to,
        });
      }
    } else {
      changes.push({
        kind: "already_in_cart",
        productId: product.id,
        title: product.title,
        quantity: existing.quantity,
        deviceQuantity: wanted,
      });
    }

    if (deviceOptionId && deviceDuration !== null) {
      const accountDuration = durationFor(product, existing.wellnessPricingId);
      if (accountDuration === null) {
        existing.wellnessPricingId = deviceOptionId;
        changes.push({
          kind: "duration_applied",
          productId: product.id,
          title: product.title,
          durationMinutes: deviceDuration,
        });
      } else if (existing.wellnessPricingId !== deviceOptionId) {
        changes.push({
          kind: "duration_kept",
          productId: product.id,
          title: product.title,
          keptMinutes: accountDuration,
          deviceMinutes: deviceDuration,
        });
      }
    }
  }

  return { lines, changes };
}

/** A device cart could list a product twice; treat it like the account rule (larger wins). */
function combineDuplicates(items: readonly GuestCartItem[]): GuestCartItem[] {
  const byProduct = new Map<string, GuestCartItem>();
  for (const item of items) {
    const current = byProduct.get(item.productId);
    if (!current) byProduct.set(item.productId, { ...item });
    else {
      current.quantity = Math.max(current.quantity, item.quantity);
      current.wellnessPricingId ??= item.wellnessPricingId;
    }
  }
  return [...byProduct.values()];
}
