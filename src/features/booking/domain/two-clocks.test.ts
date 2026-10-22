import { describe, expect, it } from "vitest";
import { clockGap, dayShiftLabel, dualTime, formatCustomerTime, formatDuration } from "./two-clocks";
import type { Zone } from "./timezone";

const bangkok: Zone = { kind: "iana", id: "Asia/Bangkok" };
const kathmandu: Zone = { kind: "iana", id: "Asia/Kathmandu" };
const kolkata: Zone = { kind: "iana", id: "Asia/Kolkata" };
const newYork: Zone = { kind: "iana", id: "America/New_York" };
const london: Zone = { kind: "iana", id: "Europe/London" };
const plus545: Zone = { kind: "offset", minutes: 345 };

describe("dualTime", () => {
  it("shows a Bangkok slot on a Kathmandu clock (the brief's story)", () => {
    const t = dualTime(bangkok, kathmandu, "2026-11-20", 10 * 60 + 40);
    expect(t.customer).toEqual({ date: "2026-11-20", minutes: 9 * 60 + 25 });
    expect(t.dayShift).toBe(0);
  });

  it("marks a late-evening slot that is already tomorrow for the customer", () => {
    // Aravali (India) 11:00 PM is 12:30 AM the next day in Bangkok
    const t = dualTime(kolkata, bangkok, "2026-11-20", 23 * 60);
    expect(t.customer).toEqual({ date: "2026-11-21", minutes: 30 });
    expect(t.dayShift).toBe(1);
    expect(formatCustomerTime(t)).toBe("12:30 AM, Sat 21 Nov");
  });

  it("marks an early slot that is still yesterday for a customer to the west", () => {
    const t = dualTime(bangkok, newYork, "2026-11-20", 10 * 60);
    expect(t.customer).toEqual({ date: "2026-11-19", minutes: 22 * 60 });
    expect(t.dayShift).toBe(-1);
  });

  it("treats a fixed +05:45 offset the same as Asia/Kathmandu", () => {
    expect(dualTime(plus545, kathmandu, "2026-11-20", 7 * 60).customer.minutes).toBe(7 * 60);
  });

  it("uses the offset in force on the slot's date, not today's (daylight saving)", () => {
    // London is UTC+1 until 25 Oct 2026, then UTC+0
    expect(dualTime(bangkok, london, "2026-10-23", 12 * 60).customer.minutes).toBe(6 * 60);
    expect(dualTime(bangkok, london, "2026-10-27", 12 * 60).customer.minutes).toBe(5 * 60);
  });
});

describe("clockGap", () => {
  const at = Date.UTC(2026, 10, 20);
  it("says how far ahead the provider is, in plain words", () => {
    expect(clockGap(bangkok, kathmandu, at)).toEqual({ minutes: 75, text: "1 h 15 min ahead of you" });
    expect(clockGap(kolkata, kathmandu, at).text).toBe("15 min behind you");
    expect(clockGap(plus545, kathmandu, at).text).toBe("the same time as you");
  });
});

describe("labels", () => {
  it("formats durations and day shifts", () => {
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(-45)).toBe("45 min");
    expect(dayShiftLabel(1)).toBe("next day");
    expect(dayShiftLabel(-1)).toBe("previous day");
    expect(dayShiftLabel(0)).toBeNull();
  });
});
