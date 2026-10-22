import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rawCartSchema } from "../api/schemas";
import { normalizeCart } from "./normalize";
import { buildGroups, totalsAcrossGroups, type ViewContext } from "./view";

// The fixture's serverCart, in the shape GET /cart returns
const fixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "data", "task2-cart.json"), "utf8"),
);
const cart = normalizeCart(rawCartSchema.parse({ ...fixture.serverCart, revision: 1 }));

const ctx = (overrides: Partial<ViewContext> = {}): ViewContext => ({
  edits: {},
  savingLines: new Set(),
  errors: {},
  maxQuantities: {},
  checkingOut: new Set(),
  online: true,
  ...overrides,
});
const group = (groups: ReturnType<typeof buildGroups>, type: string) =>
  groups.find((g) => g.type === type)!;

describe("cart view", () => {
  it("keeps subtotals per currency, matching the server's", () => {
    const labs = group(buildGroups(cart, ctx()), "lab_test");
    expect(Object.fromEntries([...labs.subtotals].map(([c, a]) => [c, a.toString()]))).toEqual({
      THB: "1677",
      NPR: "12520",
    });
    expect(labs.itemCount).toBe(4); // sum of quantities, not lines
  });

  it("never counts an unpriced wellness item as zero", () => {
    const wellness = group(buildGroups(cart, ctx()), "wellness");
    expect(wellness.subtotals.size).toBe(0);
    expect(wellness.unpricedCount).toBe(1);
    expect(wellness.lines[0]?.lineTotal).toBeNull();
    expect(wellness.blockedBy).toContainEqual(expect.objectContaining({ kind: "needs-duration" }));
  });

  it("prices a wellness item once a duration is chosen (even before the server confirms)", () => {
    const facial = cart.lines.find((l) => l.product?.title === "Signature Facial")!;
    const wellness = group(
      buildGroups(
        cart,
        ctx({
          edits: { [facial.id]: { wellnessPricingId: facial.product!.wellnessOptions[1]!.id } },
          savingLines: new Set([facial.id]),
        }),
      ),
      "wellness",
    );
    expect(wellness.subtotals.get("THB")?.toString()).toBe("2040");
    // ...but it can't be checked out until the server has it
    expect(wellness.blockedBy).toEqual([{ kind: "saving" }]);
  });

  it("marks removed services unavailable and leaves them out of totals", () => {
    const groups = buildGroups(cart, ctx());
    expect(group(groups, "unknown").unavailable).toBe(true);
    const totals = totalsAcrossGroups(groups);
    expect([...totals.keys()].sort()).toEqual(["INR", "NPR", "THB"]);
    expect(totals.get("THB")?.toString()).toBe("16907"); // 1,677 + 15,230; never mixed with NPR/INR
  });

  it("shows unsaved quantities and hides lines being removed", () => {
    const cbc = cart.lines.find((l) => l.product?.title === "CBC Profile")!;
    const liver = cart.lines.find((l) => l.product?.title === "Liver Function Profile")!;
    const labs = group(
      buildGroups(
        cart,
        ctx({ edits: { [cbc.id]: { quantity: 3 }, [liver.id]: { removing: true } } }),
      ),
      "lab_test",
    );
    expect(labs.lines.map((l) => l.product?.title)).not.toContain("Liver Function Profile");
    expect(labs.subtotals.get("THB")?.toString()).toBe("5031"); // 1,677 × 3
  });

  it("locks groups that are being checked out, and everything when offline", () => {
    const locked = buildGroups(cart, ctx({ checkingOut: new Set(["package"]) }));
    expect(group(locked, "package").blockedBy).toContainEqual({ kind: "in-checkout" });
    const offline = buildGroups(cart, ctx({ online: false }));
    expect(group(offline, "lab_test").blockedBy).toContainEqual({ kind: "offline" });
  });
});
