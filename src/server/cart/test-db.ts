import { readFileSync } from "node:fs";
import path from "node:path";
import type { CartDb } from "./store";
import type { CartFixture } from "./types";

/** A fresh in-memory db from the real fixture, for unit tests (no server-only imports). */
export function testDb(): CartDb {
  const fixture = JSON.parse(
    readFileSync(path.join(process.cwd(), "data", "task2-cart.json"), "utf8"),
  ) as CartFixture;
  return {
    catalog: new Map(fixture.catalog.map((p) => [p.id, p])),
    lines: fixture.serverCart.groups.flatMap((g) =>
      g.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        quantity: i.quantity,
        wellnessPricingId: null,
      })),
    ),
    revision: 1,
    orders: new Map(),
    idempotency: new Map(),
    guestCart: fixture.guestCart,
  };
}

export const IDS = {
  cbcLine: "dbd4cac2-eb2b-4dc7-867e-0d5c13226036",
  liverLine: "76d58b51-449b-4f90-a936-1b6008dcf67d",
  liverProduct: "7bcdaf5b-7874-4061-83ee-ef9c954ffcaf",
  bloodPanelLine: "6caa435e-3e83-4c53-9e92-80b0f006a6eb",
  facialLine: "e38e2e25-84d4-4843-85e8-a362c3dec25a",
  facialProduct: "5f0c1a52-6b1e-4c1f-9a51-000000000003",
  facial60: "a1b2c3d4-0000-4000-8000-000000000060",
  facial90: "a1b2c3d4-0000-4000-8000-000000000090",
  comprehensiveLine: "41441093-cddb-4322-9bc8-d4f4959646c1",
  comprehensiveProduct: "39e2ac98-f28b-4c9b-b7db-df93f5ad2d40",
  basicScreeningLine: "13068e11-594e-4a03-a7ec-2f0f8fc2dd01",
  basicScreeningProduct: "ae3700e0-7d54-4242-9409-033e50462304",
  removedLine: "7a15eb5e-0e1b-4cb1-9cf6-bd4344b569be",
  lipidProduct: "6a92d368-a25a-4e00-89ce-77d69da06b45",
};
