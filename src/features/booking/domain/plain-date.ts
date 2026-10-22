/**
 * Calendar dates and wall-clock times with no time zone attached.
 *
 * A booking happens on a date *at the provider* ("2026-10-27") at a time on
 * the provider's wall clock ("10:40"). Keeping those as plain values (not
 * JavaScript Dates, which are instants) means a date never silently shifts
 * because the customer's device is in another zone.
 */
export type PlainDate = string; // "YYYY-MM-DD"

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]?\d|2[0-4]):([0-5]\d)$/;

export const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export function isPlainDate(value: unknown): value is PlainDate {
  if (typeof value !== "string") return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Days are counted in UTC so no local time zone (or DST) can shift them. */
function toUtcMs(date: PlainDate): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): PlainDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: PlainDate, days: number): PlainDate {
  return fromUtcMs(toUtcMs(date) + days * 86_400_000);
}

export function daysBetween(from: PlainDate, to: PlainDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / 86_400_000);
}

export function weekdayOf(date: PlainDate): Weekday {
  return WEEKDAYS[new Date(toUtcMs(date)).getUTCDay()]!;
}

export function compareDates(a: PlainDate, b: PlainDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** "HH:MM" → minutes after midnight; null if it isn't a valid time. "24:00" is allowed as an end. */
export function parseClock(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = TIME_PATTERN.exec(value.trim());
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes <= 24 * 60 ? minutes : null;
}

/** Minutes after midnight → "HH:MM" (the API's format). */
export function toClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Minutes after midnight → "10:40 AM", for people. */
export function formatClock(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

/** "Tue 27 Oct" (or other styles). Formatted in UTC: it's a plain date, not an instant. */
export function formatPlainDate(
  date: PlainDate,
  style: "short" | "long" | "weekday" = "short",
): string {
  let formatter = dateFormatters.get(style);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      ...(style === "long"
        ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
        : style === "weekday"
          ? { weekday: "long" }
          : { weekday: "short", day: "numeric", month: "short" }),
    });
    dateFormatters.set(style, formatter);
  }
  return formatter.format(new Date(toUtcMs(date)));
}
