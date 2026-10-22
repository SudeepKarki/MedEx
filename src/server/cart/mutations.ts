import { maxQuantityFor, quantityLimitMessage } from "./rules";
import type { CartDb } from "./store";
import type { ApiResult } from "./checkout";
import { cartView } from "./view";

const ok = (db: CartDb, status = 200): ApiResult => ({ status, body: { cart: cartView(db) } });

/** PATCH /cart/items/:lineId { quantity } */
export function updateQuantity(db: CartDb, lineId: string, quantity: number): ApiResult {
  const line = db.lines.find((l) => l.id === lineId);
  if (!line)
    return {
      status: 404,
      body: { code: "LINE_NOT_FOUND", message: "This item is no longer in your cart." },
    };
  const product = db.catalog.get(line.productId);
  if (!product) {
    return {
      status: 409,
      body: {
        code: "UNAVAILABLE",
        message: "This service is no longer available, so it can't be changed.",
      },
    };
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return {
      status: 400,
      body: { code: "INVALID_QUANTITY", message: "Quantity must be at least 1." },
    };
  }
  const max = maxQuantityFor(product);
  if (quantity > max) {
    return {
      status: 409,
      body: {
        code: "QUANTITY_LIMIT",
        message: quantityLimitMessage(product, max),
        maxQuantity: max,
        quantity: line.quantity,
      },
    };
  }
  if (line.quantity !== quantity) {
    line.quantity = quantity;
    db.revision += 1;
  }
  return ok(db);
}

/** PATCH /cart/items/:lineId { wellnessPricingId } */
export function chooseDuration(db: CartDb, lineId: string, wellnessPricingId: string): ApiResult {
  const line = db.lines.find((l) => l.id === lineId);
  if (!line)
    return {
      status: 404,
      body: { code: "LINE_NOT_FOUND", message: "This item is no longer in your cart." },
    };
  const product = db.catalog.get(line.productId);
  if (!product?.wellnessPricing?.some((o) => o.id === wellnessPricingId)) {
    return {
      status: 409,
      body: {
        code: "INVALID_OPTION",
        message: "That duration isn't offered for this treatment any more.",
      },
    };
  }
  if (line.wellnessPricingId !== wellnessPricingId) {
    line.wellnessPricingId = wellnessPricingId;
    db.revision += 1;
  }
  return ok(db);
}

/** DELETE /cart/items/:lineId: idempotent, so a retried delete is harmless. */
export function removeLine(db: CartDb, lineId: string): ApiResult {
  const before = db.lines.length;
  db.lines = db.lines.filter((l) => l.id !== lineId);
  if (db.lines.length !== before) db.revision += 1;
  return { status: 204, body: null };
}

/** POST /cart/items { productId }: adds one, or one more of an existing line. */
export function addItem(db: CartDb, productId: string, newLineId: () => string): ApiResult {
  const product = db.catalog.get(productId);
  if (!product)
    return { status: 404, body: { code: "NOT_FOUND", message: "This service isn't available." } };
  const existing = db.lines.find((l) => l.productId === productId);
  if (existing) return updateQuantity(db, existing.id, existing.quantity + 1);
  db.lines.push({ id: newLineId(), productId, quantity: 1, wellnessPricingId: null });
  db.revision += 1;
  return ok(db, 201);
}
