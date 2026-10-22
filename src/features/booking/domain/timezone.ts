import type { PlainDate } from "./plain-date";
import { addDays } from "./plain-date";

/**
 * Time zones as providers type them, and conversions between them.
 *
 * A zone is either an IANA zone (DST-aware, via Intl) or a fixed UTC offset.
 * Fixed offsets are computed by hand rather than relying on Intl's newer
 * support for offset zones.
 */
export type Zone = { kind: "iana"; id: string } | { kind: "offset"; minutes: number };

export type ZoneSource = "iana" | "offset" | "windows" | "country";

export interface ResolvedZone {
  zone: Zone;
  source: ZoneSource;
  /** Exactly what the provider typed. */
  input: string;
  /** How we read it, for the data report. */
  note: string;
}

/** Fallback when the provider's value can't be understood. */
export const COUNTRY_ZONES: Record<string, string> = {
  TH: "Asia/Bangkok",
  NP: "Asia/Kathmandu",
  IN: "Asia/Kolkata",
};

/** Windows time-zone names (as exported by Outlook/Windows), mapped to IANA. Common ones for the region. */
const WINDOWS_ZONES: Record<string, string> = {
  "nepal standard time": "Asia/Kathmandu",
  "india standard time": "Asia/Kolkata",
  "se asia standard time": "Asia/Bangkok",
  "singapore standard time": "Asia/Singapore",
  "bangladesh standard time": "Asia/Dhaka",
  "sri lanka standard time": "Asia/Colombo",
  "myanmar standard time": "Asia/Yangon",
  "china standard time": "Asia/Shanghai",
  "tokyo standard time": "Asia/Tokyo",
  "arabian standard time": "Asia/Dubai",
  "gmt standard time": "Europe/London",
  utc: "UTC",
  "coordinated universal time": "UTC",
};

/** ICU still reports some zones by their old names; show the modern city. */
const MODERN_NAMES: Record<string, string> = {
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Rangoon": "Asia/Yangon",
};

const OFFSET_PATTERN = /^\(?\s*(?:utc|gmt)?\s*([+\-−])\s*(\d{1,2})(?::?(\d{2}))?\s*\)?$/i;

export function isIanaZone(id: string): boolean {
  if (!id.includes("/") && id !== "UTC") return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: id });
    return true;
  } catch {
    return false;
  }
}

/** "+05:45", "UTC+5:45", "(GMT+5:45)", "GMT-3", "+0545" → minutes east of UTC. */
export function parseOffset(value: string): number | null {
  if (/^(utc|gmt|z)$/i.test(value)) return 0;
  const match = OFFSET_PATTERN.exec(value);
  if (!match) return null;
  const sign = match[1] === "+" ? 1 : -1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? 0);
  if (hours > 14 || minutes > 59) return null;
  return sign * (hours * 60 + minutes);
}

/**
 * Reads a provider's free-text time zone. In order:
 *  1. an IANA name (trimmed; old aliases like "Asia/Katmandu" are fine);
 *  2. a UTC/GMT offset in any of the usual spellings: if it matches the
 *     zone of the provider's country, that zone is used (so we keep its
 *     name, and its DST rules where it has them); otherwise a fixed offset;
 *  3. a Windows zone name ("Nepal Standard Time");
 *  4. otherwise (empty, garbage) the provider's country.
 */
export function resolveProviderZone(
  raw: unknown,
  country: string | null,
  at = Date.now(),
): ResolvedZone {
  const input = typeof raw === "string" ? raw : "";
  const value = input.trim();
  const countryZone = country ? COUNTRY_ZONES[country.trim().toUpperCase()] : undefined;

  if (value && isIanaZone(value)) {
    return {
      zone: { kind: "iana", id: value },
      source: "iana",
      input,
      note: `IANA zone "${value}".`,
    };
  }

  const offset = value ? parseOffset(value) : null;
  if (offset !== null) {
    if (countryZone && offsetMinutes({ kind: "iana", id: countryZone }, at) === offset) {
      return {
        zone: { kind: "iana", id: countryZone },
        source: "offset",
        input,
        note: `Offset ${formatOffset(offset)} matches ${country}, so it's read as ${countryZone}.`,
      };
    }
    return {
      zone: { kind: "offset", minutes: offset },
      source: "offset",
      input,
      note: `Fixed offset ${formatOffset(offset)} (it doesn't match ${country ?? "the provider's country"}).`,
    };
  }

  const windows = WINDOWS_ZONES[value.toLowerCase()];
  if (windows) {
    return {
      zone: { kind: "iana", id: windows },
      source: "windows",
      input,
      note: `Windows zone name, read as ${windows}.`,
    };
  }

  const fallback = countryZone ?? "UTC";
  return {
    zone: { kind: "iana", id: fallback },
    source: "country",
    input,
    note: value
      ? `"${value}" isn't a time zone we recognise; using the country's zone, ${fallback}.`
      : `No time zone given; using the country's zone, ${fallback}.`,
  };
}

// ---------------------------------------------------------------------------
// Conversions

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(id: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(id);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: id,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(id, formatter);
  }
  return formatter;
}

/** The zone's wall clock at an instant, as a UTC timestamp of that wall time. */
function wallAsUtc(zone: Zone, instant: number): number {
  if (zone.kind === "offset") return instant + zone.minutes * 60_000;
  const parts = Object.fromEntries(
    partsFormatter(zone.id)
      .formatToParts(new Date(instant))
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
}

/** Minutes the zone is ahead of UTC at an instant (+345 for Kathmandu). */
export function offsetMinutes(zone: Zone, instant: number): number {
  const second = Math.floor(instant / 1000) * 1000; // Intl drops milliseconds
  return Math.round((wallAsUtc(zone, second) - second) / 60_000);
}

export interface WallClock {
  date: PlainDate;
  /** Minutes after midnight. */
  minutes: number;
}

/** What a clock in this zone shows at an instant. */
export function toWallClock(zone: Zone, instant: number): WallClock {
  const wall = wallAsUtc(zone, Math.floor(instant / 1000) * 1000);
  const date = new Date(wall).toISOString().slice(0, 10);
  const minutes = Math.floor((wall % 86_400_000) / 60_000);
  return { date, minutes };
}

/**
 * The instant at which a zone's clock shows `date` at `minutes`.
 *
 * Start from the wall time read as UTC, subtract the offset in force then,
 * and correct once more in case that crossed an offset change. In a DST gap
 * (a wall time that doesn't exist) this lands just after it; in an overlap,
 * on the first occurrence. The zones in this data have no DST.
 */
export function fromWallClock(zone: Zone, date: PlainDate, minutes: number): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const wall = Date.UTC(y, m - 1, d) + minutes * 60_000;
  let instant = wall - offsetMinutes(zone, wall) * 60_000;
  instant = wall - offsetMinutes(zone, instant) * 60_000;
  return instant;
}

/** Today's date on the zone's clock. */
export function todayIn(zone: Zone, now: number): PlainDate {
  return toWallClock(zone, now).date;
}

/** The provider's "day N", counted from today on the provider's clock. */
export function dayOffsetToDate(zone: Zone, now: number, dayOffset: number): PlainDate {
  return addDays(todayIn(zone, now), dayOffset);
}

// ---------------------------------------------------------------------------
// Labels

export function formatOffset(minutes: number): string {
  if (minutes === 0) return "UTC";
  const sign = minutes > 0 ? "+" : "−";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

/** Canonical id for comparing zones ("Asia/Kathmandu" and "Asia/Katmandu" are the same). */
export function zoneKey(zone: Zone): string {
  if (zone.kind === "offset") return `offset:${zone.minutes}`;
  try {
    const id = new Intl.DateTimeFormat("en", { timeZone: zone.id }).resolvedOptions().timeZone;
    return MODERN_NAMES[id] ?? id;
  } catch {
    return zone.id;
  }
}

/** "Bangkok", "Kathmandu", "UTC+5:45": what people call the zone. */
export function zoneCity(zone: Zone): string {
  if (zone.kind === "offset") return formatOffset(zone.minutes);
  const id = zoneKey(zone);
  if (id === "UTC") return "UTC";
  return (id.split("/").pop() ?? id).replace(/_/g, " ");
}

/** Same clock right now? (Different ids with the same offset count as the same for display.) */
export function sameClock(a: Zone, b: Zone, at: number): boolean {
  return offsetMinutes(a, at) === offsetMinutes(b, at);
}
