import { ZERO, sumByCurrency } from "@/lib/money";
import { groupTitle } from "./labels";
import type { BlockReason, Cart, CartLine, GroupView, LineView } from "./types";

/** A change the customer made that the server hasn't confirmed yet. */
export interface LineEdit {
  quantity?: number;
  wellnessPricingId?: string;
  removing?: boolean;
}

export interface ViewContext {
  edits: Readonly<Record<string, LineEdit>>;
  savingLines: ReadonlySet<string>;
  errors: Readonly<Record<string, string>>;
  maxQuantities: Readonly<Record<string, number>>;
  /** Group types currently going through checkout (locked for editing). */
  checkingOut: ReadonlySet<string>;
  /** Some checkout hasn't finished; others wait until it has. */
  checkoutBusy?: boolean;
  online: boolean;
}

function lineView(line: CartLine, ctx: ViewContext): LineView {
  const edit = ctx.edits[line.id];
  const quantity = edit?.quantity ?? line.quantity;
  const wellnessPricingId = edit?.wellnessPricingId ?? line.wellnessPricingId;
  const product = line.product;
  const chosenOption = product?.wellnessOptions.find((o) => o.id === wellnessPricingId) ?? null;
  // Wellness price is unknown until a duration is chosen. Never 0.
  const unitPrice = product
    ? product.wellnessOptions.length
      ? (chosenOption?.price ?? null)
      : product.price
    : null;
  return {
    ...line,
    quantity,
    wellnessPricingId,
    unitPrice,
    lineTotal: unitPrice ? unitPrice.times(quantity) : null,
    chosenOption,
    saving: ctx.savingLines.has(line.id),
    error: ctx.errors[line.id] ?? null,
    maxQuantity: ctx.maxQuantities[line.id] ?? null,
  };
}

/**
 * The cart as the customer sees it: server state plus their unsaved edits,
 * grouped by type, with per-currency subtotals and why a group can't be
 * checked out yet (if it can't).
 */
export function buildGroups(cart: Cart, ctx: ViewContext): GroupView[] {
  const visible = cart.lines.filter((l) => !ctx.edits[l.id]?.removing).map((l) => lineView(l, ctx));
  return cart.groupTypes
    .map((type): GroupView => {
      const lines = visible.filter((l) => (l.product?.type ?? "unknown") === type);
      const unavailable = lines.length > 0 && lines.every((l) => l.product === null);
      const priced = lines.filter((l) => l.lineTotal !== null && l.product);
      const subtotals = sumByCurrency(
        priced.map((l) => ({ currency: l.product!.currency, amount: l.lineTotal ?? ZERO })),
      );
      const blockedBy: BlockReason[] = [];
      if (unavailable) blockedBy.push({ kind: "unavailable" });
      for (const l of lines) {
        if (l.product && l.product.wellnessOptions.length && !l.chosenOption) {
          blockedBy.push({ kind: "needs-duration", lineId: l.id, title: l.product.title });
        } else if (l.product && !l.product.wellnessOptions.length && l.unitPrice === null) {
          blockedBy.push({ kind: "no-price", lineId: l.id, title: l.product.title });
        }
      }
      if (lines.some((l) => l.saving)) blockedBy.push({ kind: "saving" });
      if (ctx.checkingOut.has(type)) blockedBy.push({ kind: "in-checkout" });
      else if (ctx.checkoutBusy) blockedBy.push({ kind: "other-checkout" });
      if (!ctx.online) blockedBy.push({ kind: "offline" });
      return {
        type,
        title: groupTitle(type),
        lines,
        itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
        unpricedCount: lines
          .filter((l) => l.product && l.unitPrice === null)
          .reduce((s, l) => s + l.quantity, 0),
        subtotals,
        unavailable,
        blockedBy,
      };
    })
    .filter((g) => g.lines.length > 0);
}

/** Totals per currency across every checkable group: same currency only, never converted. */
export function totalsAcrossGroups(groups: readonly GroupView[]) {
  return sumByCurrency(
    groups
      .filter((g) => !g.unavailable)
      .flatMap((g) => [...g.subtotals].map(([currency, amount]) => ({ currency, amount }))),
  );
}

export function blockMessage(reason: BlockReason): string {
  switch (reason.kind) {
    case "needs-duration":
      return `Choose a duration for ${reason.title}`;
    case "unavailable":
      return "These services are no longer available";
    case "saving":
      return "Saving your changes…";
    case "in-checkout":
      return "Checkout in progress";
    case "other-checkout":
      return "Finish your current checkout first";
    case "no-price":
      return `${reason.title} has no price yet, so it can't be ordered`;
    case "offline":
      return "You're offline";
  }
}
