import "server-only";

import { loadDataFile } from "@/server/mock/load-json";
import type {
  CartFixture,
  CatalogProduct,
  GuestCartItem,
  IdempotencyRecord,
  ServerLine,
  ServerOrder,
} from "./types";

/**
 * The mock server's in-memory "database": one demo customer's cart, their
 * orders and the idempotency records. Kept on globalThis so it survives
 * hot reloads in development; reset with POST /api/demo/reset.
 */
export interface CartDb {
  catalog: Map<string, CatalogProduct>;
  lines: ServerLine[];
  /** Bumped on every change; lets the client ignore out-of-date responses. */
  revision: number;
  orders: Map<string, ServerOrder>;
  idempotency: Map<string, IdempotencyRecord>;
  /** First response per merge key, replayed on a retried sign-in. */
  mergeReplays: Map<string, unknown>;
  guestCart: GuestCartItem[];
}

const globalForDb = globalThis as unknown as { __medexCartDb?: Promise<CartDb> };

async function seed(): Promise<CartDb> {
  const fixture = (await loadDataFile("task2-cart.json")) as CartFixture;
  return {
    catalog: new Map(fixture.catalog.map((p) => [p.id, p])),
    lines: fixture.serverCart.groups.flatMap((group) =>
      group.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        wellnessPricingId: null,
      })),
    ),
    revision: 1,
    orders: new Map(),
    idempotency: new Map(),
    mergeReplays: new Map(),
    guestCart: fixture.guestCart,
  };
}

export function getDb(): Promise<CartDb> {
  globalForDb.__medexCartDb ??= seed();
  return globalForDb.__medexCartDb;
}

export function resetDb(): Promise<CartDb> {
  globalForDb.__medexCartDb = seed();
  return globalForDb.__medexCartDb;
}

export function touch(db: CartDb) {
  db.revision += 1;
}
