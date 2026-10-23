import { describe, expect, it } from "vitest";
import { describeDay, slotKey, type DayInput } from "./availability";
import { toClock } from "./plain-date";
import type { Provider } from "./types";

const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const riverside: Provider = {
  id: 48,
  name: "Riverside International Hospital",
  country: "TH",
  timeZone: {
    zone: { kind: "iana", id: "Asia/Bangkok" },
    source: "iana",
    input: "Asia/Bangkok",
    note: "",
  },
  schedule: {
    monday: { openMinutes: m("08:00"), closeMinutes: m("20:00") },
    thursday: { openMinutes: m("08:00"), closeMinutes: m("20:00") },
    friday: { openMinutes: m("08:00"), closeMinutes: m("17:00") },
    saturday: { openMinutes: m("09:00"), closeMinutes: m("13:00") },
  },
  closures: [{ date: "2026-11-03", reason: "Public holiday" }],
  specialists: [
    {
      id: "wong",
      name: "Dr. A. Wongsakul",
      speciality: "Cardiology",
      consultation: {
        startMinutes: m("10:00"),
        endMinutes: m("16:00"),
        durationMinutes: 30,
        bufferMinutes: 10,
      },
    },
    {
      id: "rana",
      name: "Dr. N. Rana",
      speciality: "Internal Medicine",
      consultation: {
        startMinutes: m("18:00"),
        endMinutes: m("21:00"),
        durationMinutes: 20,
        bufferMinutes: 0,
      },
    },
  ],
};
// Thursday 22 Oct 2026, 10:50 in Bangkok
const now = { today: "2026-10-22", minutes: m("10:50") };
const day = (overrides: Partial<DayInput>) =>
  describeDay({
    provider: riverside,
    date: "2026-10-22",
    now,
    specialistId: null,
    people: 1,
    booked: new Set(),
    ...overrides,
  });
const bookable = (r: ReturnType<typeof describeDay>, id: string) =>
  r.specialists
    .find((s) => s.specialist.id === id)!
    .slots.filter((s) => s.bookable)
    .map((s) => toClock(s.startMinutes));

describe("describeDay", () => {
  it("today: slots that have started by the provider's clock are unavailable", () => {
    const today = day({ specialistId: "wong" });
    const wong = today.specialists[0]!;
    expect(wong.slots.find((s) => toClock(s.startMinutes) === "10:40")?.state).toBe("started");
    expect(bookable(today, "wong")[0]).toBe("11:20");
  });

  it("shows booked slots but never offers them", () => {
    const result = day({ date: "2026-10-26", booked: new Set([slotKey("wong", m("10:40"))]) });
    const wong = result.specialists.find((s) => s.specialist.id === "wong")!;
    expect(wong.slots.find((s) => toClock(s.startMinutes) === "10:40")).toMatchObject({
      state: "booked",
      bookable: false,
    });
  });

  it("group of 2 needs two back-to-back free slots with the same specialist", () => {
    const result = day({
      date: "2026-10-26",
      people: 2,
      specialistId: "wong",
      booked: new Set([slotKey("wong", m("11:20"))]),
    });
    // 10:40 can't start a pair (11:20 is booked); 10:00 can (10:00 + 10:40)
    expect(bookable(result, "wong")).toContain("10:00");
    expect(bookable(result, "wong")).not.toContain("10:40");
    expect(bookable(result, "wong")).not.toContain("15:20"); // nothing after it
  });

  it("explains a specialist whose hours run past closing (Dr. Rana on Monday)", () => {
    const result = day({ date: "2026-10-26", specialistId: "rana" });
    expect(bookable(result, "rana").at(-1)).toBe("19:40");
    expect(result.specialists[0]!.explanation).toContain("closes at 8:00 PM on Mondays");
  });

  it("gives the reason a day can't be booked", () => {
    expect(day({ date: "2026-10-21" }).status).toEqual({ kind: "past" });
    expect(day({ date: "2026-10-25" }).status).toEqual({ kind: "closed", weekday: "Sunday" });
    expect(day({ date: "2026-11-03" }).status).toEqual({
      kind: "closure",
      reason: "Public holiday",
    });
    expect(day({ date: "2027-01-20" }).status).toEqual({ kind: "not-open-yet" }); // beyond 90 days
    expect(day({ date: "2026-10-23", specialistId: "rana" }).status.kind).toBe("specialist-off"); // Friday
  });

  it("tells fully booked, too late today and too big a group apart", () => {
    const allWong = new Set(
      Array.from({ length: 9 }, (_, i) => slotKey("wong", m("10:00") + i * 40)),
    );
    expect(day({ date: "2026-10-26", specialistId: "wong", booked: allWong }).status).toEqual({
      kind: "fully-booked",
    });
    expect(
      day({ specialistId: "wong", now: { today: "2026-10-22", minutes: m("19:00") } }).status,
    ).toEqual({ kind: "day-over" });
    // Saturday 09:00–13:00: Dr. Wongsakul has 10:00, 10:40, 11:20, 12:00. Book 10:40 and 12:00: no pairs left
    const sat = day({
      date: "2026-10-24",
      specialistId: "wong",
      people: 2,
      booked: new Set([slotKey("wong", m("10:40")), slotKey("wong", m("12:00"))]),
    });
    expect(sat.status).toEqual({ kind: "group-too-big", people: 2 });
  });

  it("rescheduling: your own slot is shown as yours, and freed for a longer run", () => {
    const current = { date: "2026-10-26", specialistId: "wong", slotTimes: ["11:20"] };
    const result = day({ date: "2026-10-26", specialistId: "wong", current, people: 1 });
    const slot = result.specialists[0]!.slots.find((s) => toClock(s.startMinutes) === "11:20")!;
    expect(slot).toMatchObject({ state: "current", bookable: false });
  });

  it("rescheduling today: your own times that have started can't be a new start", () => {
    // A booking for 2 at 10:00 and 10:40; it's 10:50, so both have started
    const current = { date: "2026-10-22", specialistId: "wong", slotTimes: ["10:00", "10:40"] };
    const result = day({ specialistId: "wong", current, people: 2 });
    const own = result.specialists[0]!.slots.filter((s) =>
      ["10:00", "10:40"].includes(toClock(s.startMinutes)),
    );
    expect(own.map((s) => s.state)).toEqual(["started", "started"]);
    expect(bookable(result, "wong")).not.toContain("10:40");
    expect(bookable(result, "wong")[0]).toBe("11:20");
  });
});
