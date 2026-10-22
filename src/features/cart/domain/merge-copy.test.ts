import { describe, expect, it } from "vitest";
import { describeMergeChange, mergeHeadline, summarizeMerge } from "./merge-copy";

describe("merge copy", () => {
  it("explains every kind of change in a sentence", () => {
    expect(
      describeMergeChange({
        kind: "quantity_raised",
        productId: "p",
        title: "Liver Function Profile",
        from: 2,
        to: 3,
      }),
    ).toMatch(/kept 3.*nothing is booked twice/);
    expect(describeMergeChange({ kind: "not_available", productId: "p", quantity: 1 })).toBe(
      "1 item from this device is no longer available, so it wasn't added.",
    );
    expect(
      describeMergeChange({
        kind: "duration_applied",
        productId: "p",
        title: "Signature Facial",
        durationMinutes: 90,
      }),
    ).toContain("90-minute");
  });

  it("headlines what was added", () => {
    expect(
      mergeHeadline([
        {
          kind: "added",
          productId: "p",
          title: "Lipid Profile",
          quantity: 1,
          durationMinutes: null,
        },
      ]),
    ).toBe("We added 1 item from this device to your account's cart");
  });

  it("doesn't say 'already in your cart' when something more useful happened to that product", () => {
    const lines = summarizeMerge([
      {
        kind: "already_in_cart",
        productId: "f",
        title: "Signature Facial",
        quantity: 1,
        deviceQuantity: 1,
      },
      { kind: "duration_applied", productId: "f", title: "Signature Facial", durationMinutes: 90 },
      {
        kind: "already_in_cart",
        productId: "c",
        title: "CBC Profile",
        quantity: 1,
        deviceQuantity: 1,
      },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("90-minute");
    expect(lines[1]).toContain("CBC Profile was already in your cart");
  });
});
