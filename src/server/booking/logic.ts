import { describeDay, slotKey, slotKeyOf, type ProviderNow } from "@/features/booking/domain/availability";
import { addDays, formatClock, isPlainDate, parseClock, toClock, type PlainDate } from "@/features/booking/domain/plain-date";
import { groupIndices } from "@/features/booking/domain/slots";
import { toWallClock } from "@/features/booking/domain/timezone";
import { BOOKING_WINDOW_DAYS, MAX_PEOPLE, type Provider } from "@/features/booking/domain/types";
import type { Booking, BookingDb } from "./store";

export interface ApiResult {
  status: number;
  body: unknown;
}

export function providerNow(provider: Provider, now: number): ProviderNow {
  const wall = toWallClock(provider.timeZone.zone, now);
  return { today: wall.date, minutes: wall.minutes };
}

/** "specialistId|HH:MM" occupied on a date, by anyone (optionally not counting one booking). */
export function occupied(db: BookingDb, providerId: number, date: PlainDate, except?: string): Set<string> {
  const set = new Set<string>();
  for (const key of db.taken.get(providerId) ?? []) {
    const [d, specialistId, time] = key.split("|");
    if (d === date && specialistId && time) set.add(slotKeyOf(specialistId, time));
  }
  for (const booking of db.bookings.values()) {
    if (booking.providerId !== providerId || booking.date !== date || booking.bookingId === except) continue;
    for (const time of booking.slotTimes) set.add(slotKeyOf(booking.specialistId, time));
  }
  return set;
}

/** GET /providers/:id/slots: the brief's shape, one entry per offered slot, with isBooked. */
export function slotsFor(db: BookingDb, provider: Provider, date: PlainDate, specialistId: string | null, now: number) {
  const booked = occupied(db, provider.id, date);
  const day = describeDay({ provider, date, now: providerNow(provider, now), specialistId, people: 1, booked });
  return {
    date,
    slots: day.specialists.flatMap((d) =>
      d.plan.offered.map((s) => ({
        specialistId: d.specialist.id,
        startTime: toClock(s.startMinutes),
        endTime: toClock(s.endMinutes),
        isBooked: booked.has(slotKey(d.specialist.id, s.startMinutes)),
      })),
    ),
  };
}

/** GET /providers/:id/availability: the next 90 days at a glance, for the calendar. */
export function availabilityFor(
  db: BookingDb,
  provider: Provider,
  specialistId: string | null,
  people: number,
  now: number,
  exceptBooking?: string,
) {
  const today = providerNow(provider, now);
  const current = exceptBooking ? db.bookings.get(exceptBooking) : undefined;
  return Array.from({ length: BOOKING_WINDOW_DAYS }, (_, i) => {
    const date = addDays(today.today, i);
    const { status } = describeDay({
      provider,
      date,
      now: today,
      specialistId,
      people,
      booked: occupied(db, provider.id, date, exceptBooking),
      current,
    });
    return { date, status };
  });
}

/** Each specialist's first date with a bookable start for the group, or null within the window. */
export function nextAvailableBySpecialist(
  db: BookingDb,
  provider: Provider,
  people: number,
  now: number,
  exceptBooking?: string,
): { specialistId: string; nextAvailable: PlainDate | null }[] {
  return provider.specialists.map((s) => ({
    specialistId: s.id,
    nextAvailable:
      availabilityFor(db, provider, s.id, people, now, exceptBooking).find((d) => d.status.kind === "available")?.date ??
      null,
  }));
}

interface SlotRequest {
  provider: Provider;
  specialistId: string;
  date: string;
  startTime: string;
  people: number;
}

/** Can `people` back-to-back appointments start here? Returns the slot times, or why not. */
function claim(db: BookingDb, req: SlotRequest, now: number, except?: Booking): { times: string[] } | { problem: ApiResult } {
  const specialist = req.provider.specialists.find((s) => s.id === req.specialistId);
  const start = parseClock(req.startTime);
  if (!specialist || !isPlainDate(req.date) || start === null || req.people < 1 || req.people > MAX_PEOPLE) {
    return { problem: { status: 400, body: { code: "BAD_REQUEST", message: "That booking request isn't valid." } } };
  }
  const day = describeDay({
    provider: req.provider,
    date: req.date,
    now: providerNow(req.provider, now),
    specialistId: specialist.id,
    people: req.people,
    booked: occupied(db, req.provider.id, req.date, except?.bookingId),
    current: except,
  });
  const slot = day.specialists[0]?.slots.find((s) => s.startMinutes === start);
  if (slot?.bookable) {
    const step = specialist.consultation.durationMinutes + specialist.consultation.bufferMinutes;
    return { times: groupIndices(0, req.people).map((k) => toClock(start + k * step)) };
  }
  // Taken = someone holds one of the times the group needs; anything else (started, off-grid,
  // outside the window, not enough time left for the group) is "unavailable"
  const run = slot ? groupIndices(slot.index, req.people) : [];
  const slots = day.specialists[0]?.slots ?? [];
  const taken = run.some((i) => slots.find((s) => s.index === i)?.state === "booked");
  return {
    problem: {
      status: 409,
      body: taken
        ? {
            code: "SLOT_TAKEN",
            message:
              req.people > 1
                ? `Someone else just booked one of the ${req.people} back-to-back times from ${formatClock(start)}.`
                : `Someone else booked ${formatClock(start)} a moment ago.`,
          }
        : { code: "SLOT_UNAVAILABLE", message: `${formatClock(start)} can't be booked any more.` },
    },
  };
}

/** Simulates "someone else got there first": their booking lands just before ours. */
export function takeBySomeoneElse(db: BookingDb, providerId: number, date: string, specialistId: string, startTime: string) {
  const set = db.taken.get(providerId) ?? new Set();
  set.add(`${date}|${specialistId}|${startTime}`);
  db.taken.set(providerId, set);
}

export function createBooking(
  db: BookingDb,
  body: { providerId: number; specialistId: string; date: string; startTime: string; numberOfPeople: number; idempotencyKey?: string },
  options: { now: number; newId: () => string },
): ApiResult {
  const request = JSON.stringify([body.providerId, body.specialistId, body.date, body.startTime, body.numberOfPeople]);
  if (body.idempotencyKey) {
    const previous = db.replies.get(body.idempotencyKey);
    if (previous && previous.request !== request) {
      return { status: 422, body: { code: "KEY_REUSED", message: "That request key was already used for a different booking." } };
    }
    if (previous) return { status: previous.status, body: previous.body };
  }
  const provider = db.providers.get(body.providerId);
  if (!provider) return { status: 404, body: { code: "NOT_FOUND", message: "Provider not found." } };
  const result = claim(db, { provider, specialistId: body.specialistId, date: body.date, startTime: body.startTime, people: body.numberOfPeople }, options.now);
  let reply: ApiResult;
  if ("problem" in result) reply = result.problem;
  else {
    const booking: Booking = {
      bookingId: options.newId(),
      providerId: provider.id,
      specialistId: body.specialistId,
      date: body.date,
      startTime: result.times[0]!,
      numberOfPeople: body.numberOfPeople,
      slotTimes: result.times,
      createdAt: new Date(options.now).toISOString(),
    };
    db.bookings.set(booking.bookingId, booking);
    reply = { status: 201, body: { bookingId: booking.bookingId, booking } };
  }
  // Definitive answers are remembered per key, so a retry after a lost reply gets the same one
  if (body.idempotencyKey && reply.status < 500) db.replies.set(body.idempotencyKey, { request, ...reply });
  return reply;
}

export function moveBooking(
  db: BookingDb,
  bookingId: string,
  body: { date: string; startTime: string },
  options: { now: number },
): ApiResult {
  const booking = db.bookings.get(bookingId);
  if (!booking) return { status: 404, body: { code: "NOT_FOUND", message: "Booking not found." } };
  if (booking.date === body.date && booking.startTime === body.startTime) return { status: 200, body: { booking } };
  const provider = db.providers.get(booking.providerId)!;
  const result = claim(
    db,
    { provider, specialistId: booking.specialistId, date: body.date, startTime: body.startTime, people: booking.numberOfPeople },
    options.now,
    booking,
  );
  if ("problem" in result) return result.problem;
  const moved: Booking = { ...booking, date: body.date, startTime: result.times[0]!, slotTimes: result.times };
  db.bookings.set(bookingId, moved);
  return { status: 200, body: { booking: moved } };
}
