/**
 * Normalises text for matching: lower case, accents stripped, punctuation to
 * spaces, whitespace collapsed. Hyphenated words are indexed both split and
 * joined so "check-up", "check up" and "checkup" all find each other.
 */
export function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, " ")
    .replace(/-+/g, "-")
    .trim()
    .split(/\s+/)
    .flatMap((word) => {
      if (!word.includes("-")) return [word];
      const parts = word.split("-").filter(Boolean);
      return [...parts, parts.join("")];
    })
    .filter(Boolean)
    .join(" ");
}

/** Tokens of a search query, normalised the same way as the indexed text. */
export function tokenize(query: string): string[] {
  const normalized = normalizeText(query);
  return normalized ? Array.from(new Set(normalized.split(" "))) : [];
}

/** True when `token` starts a word in `text` (both normalised). */
export function hasWordPrefix(text: string, token: string): boolean {
  if (text.startsWith(token)) return true;
  return text.includes(` ${token}`);
}

/** Trims and collapses internal whitespace in display text from providers. */
export function cleanDisplayText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
