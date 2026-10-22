import { z } from "zod";
import { durationFor, unitPriceMinor } from "./rules";
import type { CartDb } from "./store";
import type { OrderItem, PaymentMethod, ServerOrder } from "./types";

export const checkoutRequestSchema = z.object({
  groupType: z.string().min(1),
  items: z
    .array(
      z.object({
        lineId: z.string().min(1),
        productId: z.string().min(1),
        quantity: z.number().int().min(1),
        wellnessPricingId: z.string().nullish(),
      }),
    )
    .min(1),
  paymentMethod: z.enum(["card", "pay_at_clinic"]),
  idempotencyKey: z.string().min(8).max(200),
  /** Per currency, what the customer saw (decimal strings). A different price is refused. */
  expectedTotals: z.record(z.string(), z.string()).optional(),
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export interface ApiResult {
  status: number;
  body: unknown;
}

/** How long a card payment takes to settle at the (pretend) payment provider. */
export const CARD_SETTLE_MS = 2500;

/**
 * Behaviour forced from the Mock API panel for this one request:
 * - "declined": the bank refuses the card straight away (402)
 * - "declined-later": the order is accepted, then the payment fails
 * - "conflict": the order can't be placed (409)
 * - "server-error": the server fails before doing anything (500, not recorded)
 */
export type InjectedOutcome = "declined" | "declined-later" | "conflict" | "server-error" | null;

/** Stable description of what the request asks for, to detect a key reused for something else. */
export function fingerprint(request: CheckoutRequest): string {
  const items = [...request.items]
    .map((i) => [i.lineId, i.productId, i.quantity, i.wellnessPricingId ?? null])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const expected = Object.entries(request.expectedTotals ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return JSON.stringify([request.groupType, request.paymentMethod, items, expected]);
}

/**
 * POST /checkout. Idempotent by key: the first request with a key decides the
 * outcome, every repeat gets exactly the same response, so a retry after a
 * timeout or a reload can never place a second order. Reusing a key for a
 * different request is refused (409) rather than silently ignored.
 */
export function placeOrder(
  db: CartDb,
  request: CheckoutRequest,
  options: { now: number; newOrderId: () => string; injected: InjectedOutcome },
): ApiResult {
  const print = fingerprint(request);
  const previous = db.idempotency.get(request.idempotencyKey);
  if (previous) {
    if (previous.fingerprint === print) return { status: previous.status, body: previous.body };
    return {
      status: 409,
      body: {
        code: "IDEMPOTENCY_KEY_REUSED",
        message: "This checkout attempt was already used for a different order.",
      },
    };
  }

  // A 500 means the server failed before deciding anything: not recorded, so
  // retrying with the same key really does try again.
  if (options.injected === "server-error") {
    return {
      status: 500,
      body: { code: "SERVER_ERROR", message: "Something went wrong on our side." },
    };
  }

  const record = (result: ApiResult): ApiResult => {
    db.idempotency.set(request.idempotencyKey, { fingerprint: print, ...result });
    return result;
  };

  if (options.injected === "declined") {
    return record({
      status: 402,
      body: { code: "PAYMENT_DECLINED", message: "Your bank declined the card payment." },
    });
  }
  if (options.injected === "conflict") {
    return record({
      status: 409,
      body: { code: "CART_CHANGED", message: "Something in this order changed. Please review it." },
    });
  }

  const problem = validateAgainstCart(db, request);
  if (problem) return record({ status: 409, body: { code: "CART_CHANGED", message: problem } });

  const items = request.items.map((item): OrderItem => {
    const product = db.catalog.get(item.productId)!;
    const wellnessPricingId = item.wellnessPricingId ?? null;
    return {
      lineId: item.lineId,
      productId: item.productId,
      title: product.title,
      providerName: product.providerName,
      quantity: item.quantity,
      wellnessPricingId,
      durationMinutes: durationFor(product, wellnessPricingId),
      currency: product.currency,
      unitMinor: unitPriceMinor(product, wellnessPricingId)!,
    };
  });
  const totalsMinor: Record<string, number> = {};
  for (const item of items) {
    totalsMinor[item.currency] = (totalsMinor[item.currency] ?? 0) + item.unitMinor * item.quantity;
  }

  // The customer pays what they saw, or is asked to review: never a silent re-price.
  if (request.expectedTotals && !sameTotals(request.expectedTotals, totalsMinor)) {
    return record({
      status: 409,
      body: {
        code: "PRICE_CHANGED",
        message: "The price of this order changed since you reviewed it.",
      },
    });
  }

  const card = request.paymentMethod === "card";
  const order: ServerOrder = {
    orderId: options.newOrderId(),
    idempotencyKey: request.idempotencyKey,
    groupType: request.groupType,
    paymentMethod: request.paymentMethod as PaymentMethod,
    items,
    totalsMinor,
    createdAt: options.now,
    status: "pending",
    settleAt: card ? options.now + CARD_SETTLE_MS : null,
    outcome: card ? (options.injected === "declined-later" ? "failed" : "paid") : null,
    restored: false,
  };
  db.orders.set(order.orderId, order);

  // Booked items leave the cart; they're an order now.
  const ordered = new Set(request.items.map((i) => i.lineId));
  db.lines = db.lines.filter((l) => !ordered.has(l.id));
  db.revision += 1;

  return record({ status: 201, body: orderView(order) });
}

function sameTotals(
  expected: Record<string, string>,
  actualMinor: Record<string, number>,
): boolean {
  const currencies = new Set([...Object.keys(expected), ...Object.keys(actualMinor)]);
  for (const currency of currencies) {
    const shown = expected[currency];
    if (shown === undefined || Math.round(Number(shown) * 100) !== actualMinor[currency])
      return false;
  }
  return true;
}

/** The order must match the cart exactly as the customer reviewed it. */
function validateAgainstCart(db: CartDb, request: CheckoutRequest): string | null {
  for (const item of request.items) {
    const line = db.lines.find((l) => l.id === item.lineId);
    const product = db.catalog.get(item.productId);
    if (!line || line.productId !== item.productId) {
      return "An item in this order is no longer in your cart.";
    }
    if (!product) return "An item in this order is no longer available.";
    if (product.type !== request.groupType) return "An item doesn't belong to this order.";
    if (line.quantity !== item.quantity) {
      return `The quantity of ${product.title} changed. Please review the order.`;
    }
    if ((line.wellnessPricingId ?? null) !== (item.wellnessPricingId ?? null)) {
      return `The duration of ${product.title} changed. Please review the order.`;
    }
    if (unitPriceMinor(product, line.wellnessPricingId) === null) {
      return `Choose a duration for ${product.title} first.`;
    }
  }
  return null;
}

/**
 * GET /orders/:id. Card payments settle lazily when read: once the provider
 * has "answered", the order becomes paid or failed. A failed payment puts the
 * items back in the cart (once) so the customer can try again.
 */
export function readOrder(db: CartDb, orderId: string, now: number): ApiResult {
  const order = db.orders.get(orderId);
  if (!order) return { status: 404, body: { code: "NOT_FOUND", message: "Order not found." } };

  if (
    order.status === "pending" &&
    order.settleAt !== null &&
    now >= order.settleAt &&
    order.outcome
  ) {
    order.status = order.outcome;
    if (order.status === "failed" && !order.restored) {
      order.restored = true;
      for (const item of order.items) {
        if (!db.lines.some((l) => l.id === item.lineId)) {
          db.lines.push({
            id: item.lineId,
            productId: item.productId,
            quantity: item.quantity,
            wellnessPricingId: item.wellnessPricingId,
          });
        }
      }
      db.revision += 1;
    }
  }
  return { status: 200, body: orderView(order) };
}

export function orderView(order: ServerOrder) {
  return {
    orderId: order.orderId,
    status: order.status,
    groupType: order.groupType,
    paymentMethod: order.paymentMethod,
    totals: Object.fromEntries(Object.entries(order.totalsMinor).map(([c, m]) => [c, m / 100])),
    items: order.items.map((i) => ({
      lineId: i.lineId,
      productId: i.productId,
      title: i.title,
      providerName: i.providerName,
      quantity: i.quantity,
      durationMinutes: i.durationMinutes,
      currency: i.currency,
      unitPrice: i.unitMinor / 100,
    })),
    createdAt: new Date(order.createdAt).toISOString(),
  };
}
