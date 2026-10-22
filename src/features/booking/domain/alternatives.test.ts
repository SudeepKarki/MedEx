import { describe, expect, it } from "vitest";
import { closestAlternatives } from "./alternatives";
import type { SpecialistDay } from "./availability";
import { parseClock } from "./plain-date";

const m = (t: string) => parseClock(t)!;
function dayOf(id: string, slots: [string, boolean][]): SpecialistDay {
  return {
    specialist: { id, name: id, speciality: "", consultation: { startMinutes: 0, endMinutes: 0, durationMinutes: 30, bufferMinutes: 10 } },
    plan: { offered: [], outsideHours: [] },
    explanation: null,
    slots: slots.map(([t, bookable], index) => ({
      index,
      startMinutes: m(t),
      endMinutes: m(t) + 30,
      specialistId: id,
      state: bookable ? "free" : "booked",
      bookable,
    })),
  };
}

describe("closestAlternatives", () => {
  const wong = dayOf("wong", [
    ["10:00", true],
    ["10:40", false],
    ["11:20", false],
    ["12:00", true],
    ["12:40", true],
    ["13:20", true],
  ]);
  const rana = dayOf("rana", [["11:00", true]]);

  it("offers the nearest free starts with the same specialist, in time order", () => {
    expect(closestAlternatives([wong, rana], { specialistId: "wong", startMinutes: m("11:20") }, { anySpecialist: false })).toEqual([
      { specialistId: "wong", startMinutes: m("10:00") },
      { specialistId: "wong", startMinutes: m("12:00") },
      { specialistId: "wong", startMinutes: m("12:40") },
    ]);
  });

  it("includes other specialists when the customer chose any specialist", () => {
    const result = closestAlternatives([wong, rana], { specialistId: "wong", startMinutes: m("11:20") }, { anySpecialist: true, limit: 2 });
    expect(result).toEqual([
      { specialistId: "rana", startMinutes: m("11:00") },
      { specialistId: "wong", startMinutes: m("12:00") },
    ]);
  });

  it("returns nothing when the day has no other bookable start", () => {
    const full = dayOf("wong", [["10:00", false]]);
    expect(closestAlternatives([full], { specialistId: "wong", startMinutes: m("10:00") }, { anySpecialist: false })).toEqual([]);
  });
});
