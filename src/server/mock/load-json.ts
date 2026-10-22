import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

const cache = new Map<string, Promise<unknown>>();

/**
 * Reads a fixture from /data once per server process. This is the only place
 * that touches the raw JSON; client code reaches it through the mock API.
 */
export function loadDataFile(fileName: string): Promise<unknown> {
  let pending = cache.get(fileName);
  if (!pending) {
    pending = readFile(path.join(process.cwd(), "data", fileName), "utf8").then(
      (text) => JSON.parse(text) as unknown,
    );
    pending.catch(() => cache.delete(fileName));
    cache.set(fileName, pending);
  }
  return pending;
}
