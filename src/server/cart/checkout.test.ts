import { describe, expect, it } from "vitest";
import { CARD_SETTLE_MS, placeOrder, readOrder, type CheckoutRequest } from "./checkout";
import { IDS, testDb } from "./test-db";

let seq = 0;
const options = (overrides: Partial<Parameters<typeof placeOrder>[2]> = {}) => ({
  now: 1_000_000,
  newOrderId: () => `MX-TEST${++seq}`,
  injected: null,
  ...overrides,
});

const packages = (
  key: string,
  paymentMethod: CheckoutRequest["paymentMethod"] = "card",
): CheckoutRequest => ({
  groupType: "package",
  paymentMethod,
  idempotencyKey: key,
  items: [
    { lineId: IDS.comprehensiveLine, productId: IDS.comprehensiveProduct, quantity: 1 },
    { lineId: IDS.basicScreeningLine, productId: IDS.basicScreeningProduct, quantity: 1 },
  ],
});

describe("placeOrder: idempotency", () => {
  it("returns the same order for the same key, and places it only once", () => {
    const db = testDb();
    const first = placeOrder(db, packages("key-aaaaaaaa"), options());
    const again = placeOrder(db, packages("key-aaaaaaaa"), options());
    expect(first.status).toBe(201);
    expect(again).toEqual(first);
    expect(db.orders.size).toBe(1);
  });

  it("refuses a key reused for a different order", () => {
    const db = testDb();
    placeOrder(db, packages("key-bbbbbbbb", "card"), options());
    const other = placeOrder(db, packages("key-bbbbbbbb", "pay_at_clinic"), options());
    expect(other.status).toBe(409);
    expect(other.body).toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
  });

  it("remembers a decline for its key, but not a server error", () => {
    const db = testDb();
    expect(placeOrder(db, packages("key-cccccccc"), options({ injected: "declined" })).status).toBe(
      402,
    );
    // Same key again: still declined, even though the bank would now say yes
    expect(placeOrder(db, packages("key-cccccccc"), options()).status).toBe(402);

    expect(
      placeOrder(db, packages("key-dddddddd"), options({ injected: "server-error" })).status,
    ).toBe(500);
    // A 500 decided nothing, so the same key really does try again
    expect(placeOrder(db, packages("key-dddddddd"), options()).status).toBe(201);
    expect(db.orders.size).toBe(1);
  });
});

describe("placeOrder: validation and side effects", () => {
  it("takes the ordered lines out of the cart and totals per currency", () => {
    const db = testDb();
    const result = placeOrder(db, packages("key-eeeeeeee"), options());
    expect(result.body).toMatchObject({ totals: { THB: 15230, INR: 23009.5 }, status: "pending" });
    expect(db.lines.some((l) => l.id === IDS.comprehensiveLine)).toBe(false);
  });

  it("refuses an order that doesn't match the cart (quantity changed since review)", () => {
    const db = testDb();
    const request = packages("key-ffffffff");
    request.items[0]!.quantity = 2;
    const result = placeOrder(db, request, options());
    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({ code: "CART_CHANGED" });
    expect(db.orders.size).toBe(0);
  });

  it("refuses wellness items without a duration", () => {
    const db = testDb();
    const result = placeOrder(
      db,
      {
        groupType: "wellness",
        paymentMethod: "card",
        idempotencyKey: "key-gggggggg",
        items: [{ lineId: IDS.facialLine, productId: IDS.facialProduct, quantity: 1 }],
      },
      options(),
    );
    expect(result.status).toBe(409);
  });

  it("refuses items whose product was removed", () => {
    const db = testDb();
    const result = placeOrder(
      db,
      {
        groupType: "unknown",
        paymentMethod: "card",
        idempotencyKey: "key-hhhhhhhh",
        items: [
          {
            lineId: IDS.removedLine,
            productId: "bb78f0a1-96d2-40ea-be8b-5c5f58a72931",
            quantity: 1,
          },
        ],
      },
      options(),
    );
    expect(result.status).toBe(409);
  });
});

describe("readOrder: asynchronous card payments", () => {
  it("settles a card payment after the provider answers", () => {
    const db = testDb();
    const created = placeOrder(db, packages("key-iiiiiiii"), options()).body as { orderId: string };
    expect(readOrder(db, created.orderId, 1_000_000 + 10).body).toMatchObject({
      status: "pending",
    });
    expect(readOrder(db, created.orderId, 1_000_000 + CARD_SETTLE_MS).body).toMatchObject({
      status: "paid",
    });
  });

  it("puts items back in the cart, once, when the payment fails later", () => {
    const db = testDb();
    const created = placeOrder(
      db,
      packages("key-jjjjjjjj"),
      options({ injected: "declined-later" }),
    ).body as { orderId: string };
    const later = 1_000_000 + CARD_SETTLE_MS;
    expect(readOrder(db, created.orderId, later).body).toMatchObject({ status: "failed" });
    readOrder(db, created.orderId, later + 1000);
    expect(db.lines.filter((l) => l.id === IDS.comprehensiveLine)).toHaveLength(1);
  });

  it("leaves pay-at-clinic orders pending: booked, paid at the visit", () => {
    const db = testDb();
    const created = placeOrder(db, packages("key-kkkkkkkk", "pay_at_clinic"), options()).body as {
      orderId: string;
    };
    expect(readOrder(db, created.orderId, 9_999_999_999).body).toMatchObject({ status: "pending" });
  });
});

describe("placeOrder: the customer pays what they saw", () => {
  it("accepts the order when the totals the customer saw match", () => {
    const db = testDb();
    const request = {
      ...packages("key-llllllll"),
      expectedTotals: { THB: "15230", INR: "23009.5" },
    };
    expect(placeOrder(db, request, options()).status).toBe(201);
  });

  it("refuses it (409 PRICE_CHANGED) when the price differs, and places nothing", () => {
    const db = testDb();
    const request = {
      ...packages("key-mmmmmmmm"),
      expectedTotals: { THB: "15000", INR: "23009.5" },
    };
    const result = placeOrder(db, request, options());
    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({ code: "PRICE_CHANGED" });
    expect(db.orders.size).toBe(0);
  });
});
