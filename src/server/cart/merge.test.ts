import { describe, expect, it } from "vitest";
import { mergeGuestCart } from "./merge";
import { IDS, testDb } from "./test-db";

let n = 0;
const newId = () => `new-line-${++n}`;

describe("mergeGuestCart with the fixture's guest cart", () => {
  const db = testDb();
  const { lines, changes } = mergeGuestCart(db.lines, db.guestCart, db.catalog, newId);
  const kinds = (productId: string) =>
    changes.filter((c) => c.productId === productId).map((c) => c.kind);

  it("keeps the larger quantity when both carts have the product (never the sum)", () => {
    expect(lines.find((l) => l.productId === IDS.liverProduct)?.quantity).toBe(3);
    expect(changes).toContainEqual(
      expect.objectContaining({ kind: "quantity_raised", from: 2, to: 3 }),
    );
  });

  it("adds products only the device had", () => {
    expect(lines.filter((l) => l.productId === IDS.lipidProduct)).toHaveLength(1);
    expect(kinds(IDS.lipidProduct)).toEqual(["added"]);
  });

  it("uses the duration chosen on the device when the account had none", () => {
    expect(lines.find((l) => l.productId === IDS.facialProduct)?.wellnessPricingId).toBe(
      IDS.facial90,
    );
    expect(kinds(IDS.facialProduct)).toEqual(["already_in_cart", "duration_applied"]);
  });

  it("skips and reports products that no longer exist", () => {
    expect(changes).toContainEqual({
      kind: "not_available",
      productId: "6b572fa4-4559-4dfd-a276-9c1400ce208e",
      quantity: 1,
    });
    expect(lines.some((l) => l.productId === "6b572fa4-4559-4dfd-a276-9c1400ce208e")).toBe(false);
  });

  it("never touches the account's other lines, including the removed one", () => {
    expect(lines.find((l) => l.id === IDS.removedLine)).toBeDefined();
    expect(lines.find((l) => l.id === IDS.cbcLine)?.quantity).toBe(1);
  });

  it("is idempotent: merging the same device cart again changes nothing", () => {
    const again = mergeGuestCart(lines, db.guestCart, db.catalog, newId);
    expect(again.lines).toEqual(lines);
    expect(
      again.changes.every((c) => c.kind === "already_in_cart" || c.kind === "not_available"),
    ).toBe(true);
  });
});

describe("mergeGuestCart edge cases", () => {
  it("keeps the account's duration when both chose one, and says which was ignored", () => {
    const db = testDb();
    db.lines.find((l) => l.id === IDS.facialLine)!.wellnessPricingId = IDS.facial60;
    const { lines, changes } = mergeGuestCart(db.lines, db.guestCart, db.catalog, newId);
    expect(lines.find((l) => l.id === IDS.facialLine)?.wellnessPricingId).toBe(IDS.facial60);
    expect(changes).toContainEqual(
      expect.objectContaining({ kind: "duration_kept", keptMinutes: 60, deviceMinutes: 90 }),
    );
  });

  it("caps quantities with the same limits as editing", () => {
    const db = testDb();
    const { lines, changes } = mergeGuestCart(
      [],
      [{ productId: IDS.liverProduct, quantity: 40 }],
      db.catalog,
      newId,
    );
    expect(lines[0]?.quantity).toBe(10);
    expect(changes).toContainEqual(
      expect.objectContaining({ kind: "quantity_limited", requested: 40, to: 10 }),
    );
  });

  it("ignores a duration id that doesn't belong to the product", () => {
    const db = testDb();
    const { lines } = mergeGuestCart(
      [],
      [{ productId: IDS.facialProduct, quantity: 1, wellnessPricingId: "made-up" }],
      db.catalog,
      newId,
    );
    expect(lines[0]?.wellnessPricingId).toBeNull();
  });
});
