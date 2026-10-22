import { describe, expect, it } from "vitest";
import { toClock } from "./plain-date";
import { groupStarts, hoursExplanation, periodOf, planSlots, type Consultation } from "./slots";

const c = (start: string, end: string, duration: number, buffer: number): Consultation => {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  return {
    startMinutes: m(start),
    endMinutes: m(end),
    durationMinutes: duration,
    bufferMinutes: buffer,
  };
};
const open = (from: string, to: string) => ({
  openMinutes: Number(from.slice(0, 2)) * 60 + Number(from.slice(3)),
  closeMinutes: Number(to.slice(0, 2)) * 60 + Number(to.slice(3)),
});
const times = (slots: { startMinutes: number }[]) => slots.map((s) => toClock(s.startMinutes));

describe("planSlots (the brief's rule)", () => {
  it("repeats every duration + buffer: 10:00–16:00 with 30 + 10", () => {
    const plan = planSlots(c("10:00", "16:00", 30, 10), open("08:00", "20:00"));
    expect(times(plan.offered).slice(0, 3)).toEqual(["10:00", "10:40", "11:20"]);
    // last slot must END by 16:00: 15:20–15:50 fits, 16:00 doesn't start
    expect(times(plan.offered).at(-1)).toBe("15:20");
  });

  it("only offers the overlap with opening hours (Saturday 09:00–13:00)", () => {
    const plan = planSlots(c("10:00", "16:00", 30, 10), open("09:00", "13:00"));
    // 12:40 would end at 13:10, after closing
    expect(times(plan.offered)).toEqual(["10:00", "10:40", "11:20", "12:00"]);
    expect(times(plan.outsideHours)[0]).toBe("12:40");
  });

  it("keeps the grid anchored to the consultation start when opening cuts the morning", () => {
    // Dr. Chaiyaporn: 07:00–12:00, 45 + 15; the hospital opens at 08:00
    const plan = planSlots(c("07:00", "12:00", 45, 15), open("08:00", "20:00"));
    expect(times(plan.offered)).toEqual(["08:00", "09:00", "10:00", "11:00"]);
    expect(times(plan.outsideHours)).toEqual(["07:00"]);
  });

  it("offers nothing when the consultation is entirely outside opening hours (Dr. Rana on Friday)", () => {
    const plan = planSlots(c("18:00", "21:00", 20, 0), open("08:00", "17:00"));
    expect(plan.offered).toEqual([]);
    expect(plan.outsideHours).toHaveLength(9);
  });

  it("allows a late-evening slot that ends exactly at closing", () => {
    // Dr. Mehra: 21:00–23:30, 25 + 5, open until 23:30
    const plan = planSlots(c("21:00", "23:30", 25, 5), open("08:00", "23:30"));
    expect(times(plan.offered)).toEqual(["21:00", "21:30", "22:00", "22:30", "23:00"]);
  });

  it("offers nothing on a closed day and rejects nonsense durations", () => {
    expect(planSlots(c("10:00", "16:00", 30, 10), null).offered).toEqual([]);
    expect(planSlots(c("10:00", "16:00", 0, 0), open("08:00", "20:00")).offered).toEqual([]);
  });
});

describe("groupStarts: N consecutive free slots with the same specialist", () => {
  const plan = planSlots(c("10:00", "12:00", 30, 10), open("08:00", "20:00")); // 10:00, 10:40, 11:20
  const free = (booked: string[]) => (s: { startMinutes: number }) =>
    !booked.includes(toClock(s.startMinutes));
  const starts = (set: Set<number>) =>
    [...set].sort().map((i) => toClock(plan.offered[i]!.startMinutes));

  it("only offers start times followed by enough free slots (buffers in between are fine)", () => {
    expect(starts(groupStarts(plan.offered, free([]), 2))).toEqual(["10:00", "10:40"]);
    expect(starts(groupStarts(plan.offered, free([]), 3))).toEqual(["10:00"]);
    expect(starts(groupStarts(plan.offered, free([]), 4))).toEqual([]);
  });

  it("a booked slot breaks the run", () => {
    expect(starts(groupStarts(plan.offered, free(["10:40"]), 2))).toEqual([]);
    expect(starts(groupStarts(plan.offered, free(["10:00"]), 2))).toEqual(["10:40"]);
  });

  it("closing time breaks the run (the next slot would be outside opening hours)", () => {
    const saturday = planSlots(c("10:00", "16:00", 30, 10), open("09:00", "13:00"));
    const fits = groupStarts(saturday.offered, () => true, 2);
    // 12:00 + next (12:40) would end after 13:00
    expect(
      [...fits].map((i) => toClock(saturday.offered.find((s) => s.index === i)!.startMinutes)),
    ).not.toContain("12:00");
  });
});

describe("periods and explanations", () => {
  it("groups by the provider's clock", () => {
    expect(periodOf(11 * 60 + 59)).toBe("morning");
    expect(periodOf(12 * 60)).toBe("afternoon");
    expect(periodOf(17 * 60)).toBe("evening");
  });

  it("explains why advertised hours aren't offered", () => {
    const consult = c("18:00", "21:00", 20, 0);
    const monday = open("08:00", "20:00");
    expect(
      hoursExplanation("Dr. N. Rana", consult, monday, "Monday", planSlots(consult, monday)),
    ).toBe(
      "Dr. N. Rana sees patients 6:00 PM – 9:00 PM, but the provider closes at 8:00 PM on Mondays, so only 6:00 PM – 8:00 PM can be booked.",
    );
    const friday = open("08:00", "17:00");
    expect(
      hoursExplanation("Dr. N. Rana", consult, friday, "Friday", planSlots(consult, friday)),
    ).toContain("only open 8:00 AM – 5:00 PM, so there are no times to book");
    const full = c("10:00", "16:00", 30, 10);
    expect(hoursExplanation("Dr. A", full, monday, "Monday", planSlots(full, monday))).toBeNull();
  });
});
