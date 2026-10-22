import { readFileSync } from "node:fs";
import path from "node:path";
import type { RawCatalog } from "../api/raw-schemas";
import { buildCatalog } from "../domain/catalog";
import { createIndex, type ExplorerIndex } from "../domain/engine";
import type { Catalog } from "../domain/types";

let raw: RawCatalog | null = null;
let catalog: Catalog | null = null;
let index: ExplorerIndex | null = null;

/** The real assessment data, as the mock API serves it. Tests only. */
export function rawFixture(): RawCatalog {
  raw ??= JSON.parse(
    readFileSync(path.join(process.cwd(), "data", "task1-service-explorer.json"), "utf8"),
  ) as RawCatalog;
  return raw;
}

export function fixtureCatalog(): Catalog {
  catalog ??= buildCatalog(rawFixture());
  return catalog;
}

export function fixtureIndex(): ExplorerIndex {
  index ??= createIndex(fixtureCatalog());
  return index;
}

export const VITAMIN_D_ID = "5f0c1a52-6b1e-4c1f-9a51-000000000005";
export const FREE_DENTAL_ID = "5f0c1a52-6b1e-4c1f-9a51-000000000006";
export const MESSY_TITLE_ID = "5f0c1a52-6b1e-4c1f-9a51-000000000007";
export const SIGNATURE_FACIAL_ID = "5f0c1a52-6b1e-4c1f-9a51-000000000003";
export const DISABLED_THYROID_ID = "5f0c1a52-6b1e-4c1f-9a51-000000000004";
