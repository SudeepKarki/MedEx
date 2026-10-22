import { describe, expect, it } from "vitest";
import type { SlotView, SpecialistDay } from "../domain/availability";
import { alternativesAfterConflict, bookedKeys, nextFreeDay, slotProblem } from "./day-view";

const slot = (over: Partial<SlotView>): SlotView => ({
  index: 0,
  startMinutes: 600,
  endMinutes: 630,
  specialistId: "wong",
  state: "free",
  bookable: true,
  ...over,
});
const choice = { specialistId: "wong", startTime: "10:00" };

describe("slotProblem", () => {
  it("says why the chosen time can't be booked, in the customer's terms", () => {
    expect(slotProblem(choice, slot({}), 1)).toBeNull();
    expect(slotProblem(choice, slot({ state: "booked", bookable: false }), 1)).toMatch(/just been booked by someone else/);
    expect(slotProblem(choice, slot({ state: "started", bookable: false }), 1)).toMatch(/already started/);
    expect(slotProblem(choice, slot({ bookable: false }), 3)).toMatch(/doesn't have 3 free times in a row/);
    expect(slotProblem(choice, undefined, 1)).toMatch(/isn't offered/);
  });
});

describe("alternativesAfterConflict", () => {
  const day: SpecialistDay[] = [
    {
      specialist: { id: "wong", name: "W", speciality: "", consultation: { startMinutes: 600, endMinutes: 960, durationMinutes: 30, bufferMinutes: 10 } },
      plan: { offered: [], outsideHours: [] },
      explanation: null,
      slots: [slot({ index: 0, bookable: false, state: "booked" }), slot({ index: 1, startMinutes: 640 })],
    },
  ];
  const wanted = { date: "2026-10-26", slot: choice };

  it("waits for the refetched slots, so the taken time is never offered back", () => {
    expect(alternativesAfterConflict({ wanted, date: "2026-10-26", day, fresh: false, anySpecialist: false })).toBeNull();
    expect(alternativesAfterConflict({ wanted, date: "2026-10-26", day, fresh: true, anySpecialist: false })).toEqual([
      { specialistId: "wong", startMinutes: 640 },
    ]);
  });

  it("offers nothing for a different day than the one that was taken", () => {
    expect(alternativesAfterConflict({ wanted, date: "2026-10-27", day, fresh: true, anySpecialist: false })).toBeNull();
  });
});

describe("helpers", () => {
  it("turns the /slots response into taken keys", () => {
    const keys = bookedKeys([
      { specialistId: "wong", startTime: "10:00", endTime: "10:30", isBooked: true },
      { specialistId: "wong", startTime: "10:40", endTime: "11:10", isBooked: false },
    ]);
    expect([...keys]).toEqual(["wong|10:00"]);
  });

  it("finds the next free day after a date, else the first in the window", () => {
    const days = [
      { date: "2026-10-22", status: { kind: "available" as const, bookableStarts: 2 } },
      { date: "2026-10-23", status: { kind: "fully-booked" as const } },
    ];
    expect(nextFreeDay(days, "2026-10-22")).toBe("2026-10-22");
    expect(nextFreeDay(undefined, "2026-10-22")).toBeNull();
  });
});
