import { cn as mergeClasses } from "cn";

type ClassValue = Parameters<typeof mergeClasses>[number];

const cache = new Map<string, string>();
const MAX_CACHE = 2000;

/**
 * Tailwind class merging, memoised. Profiling a filter change showed ~25% of
 * the JavaScript time going into re-merging the same static class strings for
 * every Button/Badge/input on each render. Inputs here are almost always
 * plain strings, so the result is cached by its arguments.
 */
export function cn(...inputs: ClassValue[]): string {
  let key = "";
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input !== "string") return mergeClasses(...inputs); // objects/arrays: don't cache
    key += `${input}\u0000`;
  }
  let result = cache.get(key);
  if (result === undefined) {
    result = mergeClasses(...inputs);
    if (cache.size >= MAX_CACHE) cache.clear();
    cache.set(key, result);
  }
  return result;
}
