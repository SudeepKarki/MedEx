import "server-only";

import { normalizeProvider } from "@/features/booking/domain/normalize";
import { addDays, parseClock, toClock, type PlainDate } from "@/features/booking/domain/plain-date";
import { todayIn } from "@/features/booking/domain/timezone";
import type { Provider } from "@/features/booking/domain/types";
import { loadDataFile } from "@/server/mock/load-json";

interface Fixture {
  providers: Record<string, unknown>[];
  closures: { providerId: number; dayOffset: number; reason: string }[];
  bookedSlots: { providerId: number; specialistId: string; dayOffset: number; startTime: string }[];
  existingBooking: {
    bookingId: string;
    providerId: number;
    specialistId: string;
    dayOffset: number;
    startTime: string;
    numberOfPeople: number;
  };
}

export interface Booking {
  bookingId: string;
  providerId: number;
  specialistId: string;
  date: PlainDate;
  startTime: string;
  numberOfPeople: number;
  /** Grid start times occupied (one per person, back to back). */
  slotTimes: string[];
  createdAt: string;
}

/**
 * The booking mock's in-memory state. dayOffsets become real dates *here*,
 * when the server starts, each counted from today on that provider's clock,
 * so the fixture never goes stale.
 */
export interface BookingDb {
  startedAt: number;
  /** Raw provider records (production shape) plus closures as dates. */
  rawProviders: Map<number, Record<string, unknown>>;
  providers: Map<number, Provider>;
  /** providerId → "date|specialistId|HH:MM" taken by other people. */
  taken: Map<number, Set<string>>;
  bookings: Map<string, Booking>;
  /** POST idempotency: key → the request it came with and the response it produced. */
  replies: Map<string, { request: string; status: number; body: unknown }>;
}

const globalForDb = globalThis as unknown as { __medexBookingDb?: Promise<BookingDb> };

async function seed(): Promise<BookingDb> {
  const fixture = (await loadDataFile("task3-booking.json")) as Fixture;
  const startedAt = Date.now();
  const rawProviders = new Map<number, Record<string, unknown>>();
  const providers = new Map<number, Provider>();
  const today = new Map<number, PlainDate>();

  for (const raw of fixture.providers) {
    const id = raw.id as number;
    const draft = normalizeProvider(raw, startedAt);
    if (!draft) continue;
    const providerToday = todayIn(draft.provider.timeZone.zone, startedAt);
    today.set(id, providerToday);
    const closures = fixture.closures
      .filter((c) => c.providerId === id)
      .map((c) => ({ date: addDays(providerToday, c.dayOffset), reason: c.reason }));
    const withClosures = { ...raw, closures };
    rawProviders.set(id, withClosures);
    providers.set(id, normalizeProvider(withClosures, startedAt)!.provider);
  }

  const taken = new Map<number, Set<string>>();
  for (const slot of fixture.bookedSlots) {
    const date = today.get(slot.providerId);
    if (!date) continue;
    const set = taken.get(slot.providerId) ?? new Set();
    set.add(`${addDays(date, slot.dayOffset)}|${slot.specialistId}|${slot.startTime}`);
    taken.set(slot.providerId, set);
  }

  const existing = fixture.existingBooking;
  const existingDate = addDays(today.get(existing.providerId) ?? "1970-01-01", existing.dayOffset);
  const existingProvider = providers.get(existing.providerId);
  const specialist = existingProvider?.specialists.find((s) => s.id === existing.specialistId);
  const start = parseClock(existing.startTime) ?? 0;
  const step = specialist ? specialist.consultation.durationMinutes + specialist.consultation.bufferMinutes : 0;
  const booking: Booking = {
    bookingId: existing.bookingId,
    providerId: existing.providerId,
    specialistId: existing.specialistId,
    date: existingDate,
    startTime: existing.startTime,
    numberOfPeople: existing.numberOfPeople,
    slotTimes: Array.from({ length: existing.numberOfPeople }, (_, k) => toClock(start + k * step)),
    createdAt: new Date(startedAt).toISOString(),
  };

  return { startedAt, rawProviders, providers, taken, bookings: new Map([[booking.bookingId, booking]]), replies: new Map() };
}

export function getBookingDb(): Promise<BookingDb> {
  globalForDb.__medexBookingDb ??= seed();
  return globalForDb.__medexBookingDb;
}

export function resetBookingDb(): Promise<BookingDb> {
  globalForDb.__medexBookingDb = seed();
  return globalForDb.__medexBookingDb;
}
