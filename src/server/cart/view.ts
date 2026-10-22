import type { CartDb } from "./store";
import { unitPriceMinor } from "./rules";
import type { ServerLine } from "./types";

/**
 * Builds the GET /v2/cart response from the server's lines. Mirrors the
 * production shape (groups by product type, per-currency subtotals, an
 * "unknown" group for lines whose product was removed) plus two fields the
 * client relies on: each line's chosen `wellnessPricingId`, and `revision`.
 */
export function cartView(db: CartDb) {
  const groups = new Map<
    string,
    {
      type: string;
      itemCount: number;
      unpricedItems: number;
      subtotalsMinor: Map<string, number>;
      items: unknown[];
    }
  >();

  for (const line of db.lines) {
    const product = db.catalog.get(line.productId);
    const type = product?.type ?? "unknown";
    let group = groups.get(type);
    if (!group) {
      group = { type, itemCount: 0, unpricedItems: 0, subtotalsMinor: new Map(), items: [] };
      groups.set(type, group);
    }
    group.itemCount += line.quantity;
    const unit = product ? unitPriceMinor(product, line.wellnessPricingId) : null;
    if (unit === null || !product) {
      group.unpricedItems += line.quantity;
    } else {
      group.subtotalsMinor.set(
        product.currency,
        (group.subtotalsMinor.get(product.currency) ?? 0) + unit * line.quantity,
      );
    }
    group.items.push(lineView(line, db));
  }

  return {
    groups: [...groups.values()].map(({ subtotalsMinor, ...group }) => ({
      ...group,
      subtotals: Object.fromEntries([...subtotalsMinor].map(([c, minor]) => [c, minor / 100])),
    })),
    totalItems: db.lines.reduce((sum, l) => sum + l.quantity, 0),
    revision: db.revision,
  };
}

function lineView(line: ServerLine, db: CartDb) {
  const product = db.catalog.get(line.productId);
  return {
    id: line.id,
    productId: line.productId,
    quantity: line.quantity,
    wellnessPricingId: line.wellnessPricingId,
    // A removed service comes back as an empty object, as in production.
    product: product ?? {},
  };
}
