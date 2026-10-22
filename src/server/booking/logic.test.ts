import { describe, expect, it } from "vitest";
import fixture from "../../../data/task3-booking.json";
import { normalizeProvider } from "@/features/booking/domain/normalize";
import { availabilityFor, createBooking, moveBooking, occupied, slotsFor, takeBySomeoneElse } from "./logic";
import type { Booking, BookingDb } from "./store";

// Monday 26 Oct 2026, 09:00 in Bangkok (UTC+7)
const MONDAY_9AM = Date.UTC(2026, 9, 26, 2, 0);
const DR_WONGSAKUL = "2a2f07eb-7886-4f83-82ab-ca56f415da44"; // 10:00–16:00, 30 + 10

function makeDb(): BookingDb {
  const provider = normalizeProvider(fixture.providers[0], MONDAY_9AM)!.provider;
  return {
    startedAt: MONDAY_9AM,
    rawProviders: new Map(),
    providers: new Map([[provider.id, provider]]),
    taken: new Map(),
    bookings: new Map(),
    replies: new Map(),
  };
}

let counter = 0;
const options = (now = MONDAY_9AM) => ({ now, newId: () => `BK-TEST-${++counter}` });
const request = (overrides: Partial<Parameters<typeof createBooking>[1]> = {}) => ({
  providerId: 48,
  specialistId: DR_WONGSAKUL,
  date: "2026-10-27",
  startTime: "10:40",
  numberOfPeople: 1,
  ...overrides,
});
const bookingOf = (result: { body: unknown }) => (result.body as { booking: Booking }).booking;

describe("createBooking", () => {
  it("books a free slot, which then shows as booked", () => {
    const db = makeDb();
    const result = createBooking(db, request(), options());
    expect(result.status).toBe(201);
    const slots = slotsFor(db, db.providers.get(48)!, "2026-10-27", DR_WONGSAKUL, MONDAY_9AM).slots;
    expect(slots.find((s) => s.startTime === "10:40")?.isBooked).toBe(true);
  });

  it("books N back-to-back grid slots for a group (the buffer stays between them)", () => {
    const db = makeDb();
    const booking = bookingOf(createBooking(db, request({ startTime: "10:00", numberOfPeople: 3 }), options()));
    expect(booking.slotTimes).toEqual(["10:00", "10:40", "11:20"]);
  });

  it("refuses a group when one of the following slots is taken", () => {
    const db = makeDb();
    takeBySomeoneElse(db, 48, "2026-10-27", DR_WONGSAKUL, "11:20");
    const result = createBooking(db, request({ startTime: "10:00", numberOfPeople: 3 }), options());
    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({ code: "SLOT_TAKEN" });
  });

  it("returns 409 when someone else got there first", () => {
    const db = makeDb();
    takeBySomeoneElse(db, 48, "2026-10-27", DR_WONGSAKUL, "10:40");
    expect(createBooking(db, request(), options()).status).toBe(409);
  });

  it("refuses a slot that has already started by the provider's clock", () => {
    const db = makeDb();
    const tenPast10 = MONDAY_9AM + 70 * 60_000;
    const result = createBooking(db, request({ date: "2026-10-26", startTime: "10:00" }), options(tenPast10));
    expect(result).toMatchObject({ status: 409, body: { code: "SLOT_UNAVAILABLE" } });
  });

  it("refuses times off the slot grid and days outside the 90-day window", () => {
    const db = makeDb();
    expect(createBooking(db, request({ startTime: "10:30" }), options()).status).toBe(409);
    expect(createBooking(db, request({ date: "2027-01-25" }), options()).status).toBe(409);
  });

  it("replays the same answer for a retried idempotency key, without booking twice", () => {
    const db = makeDb();
    const first = createBooking(db, request({ idempotencyKey: "key-123456" }), options());
    const retry = createBooking(db, request({ idempotencyKey: "key-123456" }), options());
    expect(retry).toEqual(first);
    expect(db.bookings.size).toBe(1);
  });

  it("rejects a reused key carrying a different booking", () => {
    const db = makeDb();
    createBooking(db, request({ idempotencyKey: "key-123456" }), options());
    expect(createBooking(db, request({ idempotencyKey: "key-123456", startTime: "11:20" }), options()).status).toBe(422);
  });
});

describe("moveBooking", () => {
  it("moves to a free slot and frees the old one", () => {
    const db = makeDb();
    const { bookingId } = bookingOf(createBooking(db, request(), options()));
    const result = moveBooking(db, bookingId, { date: "2026-10-28", startTime: "14:00" }, options());
    expect(result.status).toBe(200);
    expect(occupied(db, 48, "2026-10-27").size).toBe(0);
    expect(occupied(db, 48, "2026-10-28").has(`${DR_WONGSAKUL}|14:00`)).toBe(true);
  });

  it("treats moving to where it already is as success (safe to retry)", () => {
    const db = makeDb();
    const { bookingId } = bookingOf(createBooking(db, request(), options()));
    expect(moveBooking(db, bookingId, { date: "2026-10-27", startTime: "10:40" }, options()).status).toBe(200);
  });

  it("lets a group move onto a run that overlaps its own current slots", () => {
    const db = makeDb();
    const { bookingId } = bookingOf(createBooking(db, request({ startTime: "10:00", numberOfPeople: 2 }), options()));
    const moved = bookingOf(moveBooking(db, bookingId, { date: "2026-10-27", startTime: "10:40" }, options()));
    expect(moved.slotTimes).toEqual(["10:40", "11:20"]);
  });

  it("returns 409 when the new slot is taken", () => {
    const db = makeDb();
    const { bookingId } = bookingOf(createBooking(db, request(), options()));
    takeBySomeoneElse(db, 48, "2026-10-28", DR_WONGSAKUL, "14:00");
    expect(moveBooking(db, bookingId, { date: "2026-10-28", startTime: "14:00" }, options()).status).toBe(409);
  });
});

describe("availabilityFor", () => {
  it("covers 90 days from today at the provider and explains every closed day", () => {
    const db = makeDb();
    const days = availabilityFor(db, db.providers.get(48)!, null, 1, MONDAY_9AM);
    expect(days).toHaveLength(90);
    expect(days[0]?.date).toBe("2026-10-26");
    expect(days.find((d) => d.date === "2026-11-01")?.status).toEqual({ kind: "closed", weekday: "Sunday" });
  });

  it("counts the booking being rescheduled as free when asked to", () => {
    const db = makeDb();
    const { bookingId } = bookingOf(createBooking(db, request({ date: "2026-10-31", startTime: "10:00", numberOfPeople: 1 }), options()));
    // Saturday 09:00–13:00: Dr. Wongsakul has 10:00, 10:40, 11:20, 12:00
    for (const t of ["10:40", "11:20", "12:00"]) takeBySomeoneElse(db, 48, "2026-10-31", DR_WONGSAKUL, t);
    const status = (except?: string) =>
      availabilityFor(db, db.providers.get(48)!, DR_WONGSAKUL, 1, MONDAY_9AM, except).find((d) => d.date === "2026-10-31")?.status.kind;
    expect(status()).toBe("fully-booked");
    // Its own slot frees up, but moving onto it isn't a change, so there's still nothing new
    expect(status(bookingId)).toBe("fully-booked");
  });
});
