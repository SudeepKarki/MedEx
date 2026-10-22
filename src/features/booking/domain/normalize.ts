import { rawProviderSchema, rawSpecialistSchema, type RawProvider } from "../api/raw-schemas";
import { WEEKDAYS, isPlainDate, parseClock, type Weekday } from "./plain-date";
import type { OpeningHours } from "./slots";
import { resolveProviderZone } from "./timezone";
import type { Provider, Specialist } from "./types";

export interface ProviderIssue {
  field: string;
  detail: string;
}

/**
 * Raw provider (as the API sends it) → the booking domain's provider, with a
 * note for anything we had to interpret or drop. Used by the mock server and
 * the browser, so both read the data the same way.
 */
export function normalizeProvider(
  value: unknown,
  at = Date.now(),
): { provider: Provider; issues: ProviderIssue[] } | null {
  const parsed = rawProviderSchema.safeParse(value);
  if (!parsed.success) return null;
  const raw: RawProvider = parsed.data;
  const issues: ProviderIssue[] = [];
  const country = raw.country?.trim().toUpperCase() || null;
  const timeZone = resolveProviderZone(raw.timezone, country, at);
  if (timeZone.source !== "iana") issues.push({ field: "timezone", detail: timeZone.note });

  const schedule: Partial<Record<Weekday, OpeningHours>> = {};
  for (const [key, hours] of Object.entries(raw.daySchedules ?? {})) {
    const weekday = key.trim().toLowerCase() as Weekday;
    if (!WEEKDAYS.includes(weekday) || !hours) continue;
    const open = parseClock(hours.startTime);
    const close = parseClock(hours.endTime);
    if (open === null || close === null || close <= open) {
      issues.push({ field: `daySchedules.${key}`, detail: `Unreadable hours "${hours.startTime}–${hours.endTime}": treated as closed.` });
      continue;
    }
    schedule[weekday] = { openMinutes: open, closeMinutes: close };
  }

  const specialists: Specialist[] = [];
  for (const item of raw.specialists ?? []) {
    const s = rawSpecialistSchema.safeParse(item);
    if (!s.success) {
      issues.push({ field: "specialists", detail: "A specialist record was unreadable and skipped." });
      continue;
    }
    const start = parseClock(s.data.consultation.startTime);
    const end = parseClock(s.data.consultation.endTime);
    const duration = s.data.consultation.durationInMinutes;
    const buffer = s.data.consultation.bufferInMinutes ?? 0;
    if (start === null || end === null || end <= start || duration <= 0 || buffer < 0) {
      issues.push({ field: `specialists.${s.data.id}`, detail: `${s.data.name}: unreadable consultation hours, skipped.` });
      continue;
    }
    specialists.push({
      id: s.data.id,
      name: s.data.name.trim(),
      speciality: s.data.speciality?.trim() || "Specialist",
      consultation: { startMinutes: start, endMinutes: end, durationMinutes: duration, bufferMinutes: buffer },
    });
  }

  return {
    provider: {
      id: raw.id,
      name: raw.name.trim(),
      country,
      timeZone,
      schedule,
      closures: (raw.closures ?? [])
        .filter((c) => isPlainDate(c.date))
        .map((c) => ({ date: c.date, reason: c.reason?.trim() || "Closed" })),
      specialists,
    },
    issues,
  };
}
