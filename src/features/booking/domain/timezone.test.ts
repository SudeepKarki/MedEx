import { describe, expect, it } from "vitest";
import {
  dayOffsetToDate,
  formatOffset,
  fromWallClock,
  offsetMinutes,
  parseOffset,
  resolveProviderZone,
  sameClock,
  toWallClock,
  todayIn,
  zoneCity,
  zoneKey,
  type Zone,
} from "./timezone";

const at = Date.UTC(2026, 9, 22, 6, 0); // Thu 22 Oct 2026, 06:00 UTC
const bangkok: Zone = { kind: "iana", id: "Asia/Bangkok" };
const kathmandu: Zone = { kind: "iana", id: "Asia/Kathmandu" };
const kolkata: Zone = { kind: "iana", id: "Asia/Kolkata" };

describe("resolveProviderZone: every value in the data", () => {
  it.each([
    ["Asia/Bangkok", "TH", "Asia/Bangkok", "iana"],
    [" UTC+05:45", "NP", "Asia/Kathmandu", "offset"],
    ["Nepal Standard Time", "NP", "Asia/Kathmandu", "windows"],
    ["(GMT+5:45)", "NP", "Asia/Kathmandu", "offset"],
    ["Asia/Katmandu ", "NP", "Asia/Kathmandu", "iana"],
    ["", "IN", "Asia/Kolkata", "country"],
  ])("%j (%s) → %s via %s", (raw, country, expected, source) => {
    const resolved = resolveProviderZone(raw, country, at);
    expect(zoneKey(resolved.zone)).toBe(expected);
    expect(resolved.source).toBe(source);
    expect(resolved.input).toBe(raw);
    expect(offsetMinutes(resolved.zone, at)).toBe(
      offsetMinutes({ kind: "iana", id: expected }, at),
    );
  });

  it("falls back to the country for values it can't read", () => {
    expect(resolveProviderZone("Bangkok time", "TH", at)).toMatchObject({
      source: "country",
      zone: { id: "Asia/Bangkok" },
    });
    expect(resolveProviderZone(null, "NP", at).source).toBe("country");
    expect(resolveProviderZone("Mars/Olympus", "IN", at).zone).toEqual({
      kind: "iana",
      id: "Asia/Kolkata",
    });
  });

  it("keeps a fixed offset that doesn't match the country instead of guessing", () => {
    const resolved = resolveProviderZone("UTC+7", "NP", at);
    expect(resolved.zone).toEqual({ kind: "offset", minutes: 420 });
  });
});

describe("parseOffset", () => {
  it("reads the usual spellings", () => {
    expect(parseOffset("UTC+05:45")).toBe(345);
    expect(parseOffset("(GMT+5:45)")).toBe(345);
    expect(parseOffset("+0545")).toBe(345);
    expect(parseOffset("GMT-3")).toBe(-180);
    expect(parseOffset("UTC−05:30")).toBe(-330); // Unicode minus
    expect(parseOffset("UTC")).toBe(0);
    expect(parseOffset("UTC+25")).toBeNull();
    expect(parseOffset("Nepal")).toBeNull();
  });
});

describe("conversions", () => {
  it("knows the region's offsets, including Nepal's 45 minutes", () => {
    expect(offsetMinutes(bangkok, at)).toBe(420);
    expect(offsetMinutes(kathmandu, at)).toBe(345);
    expect(offsetMinutes(kolkata, at)).toBe(330);
    expect(formatOffset(345)).toBe("UTC+5:45");
  });

  it("converts a Bangkok wall time to the instant and to Kathmandu's clock", () => {
    const instant = fromWallClock(bangkok, "2026-10-27", 10 * 60 + 40);
    expect(new Date(instant).toISOString()).toBe("2026-10-27T03:40:00.000Z");
    expect(toWallClock(kathmandu, instant)).toEqual({ date: "2026-10-27", minutes: 9 * 60 + 25 });
  });

  it("crosses midnight: 11:00 PM in India is 12:30 AM the next day in Bangkok", () => {
    const instant = fromWallClock(kolkata, "2026-10-27", 23 * 60);
    expect(toWallClock(bangkok, instant)).toEqual({ date: "2026-10-28", minutes: 30 });
  });

  it("round-trips fixed offsets", () => {
    const fixed: Zone = { kind: "offset", minutes: 345 };
    const instant = fromWallClock(fixed, "2026-10-27", 22 * 60);
    expect(toWallClock(fixed, instant)).toEqual({ date: "2026-10-27", minutes: 22 * 60 });
    expect(toWallClock(kathmandu, instant)).toEqual({ date: "2026-10-27", minutes: 22 * 60 });
  });

  it("handles DST zones too (London, last Sunday of October)", () => {
    const london: Zone = { kind: "iana", id: "Europe/London" };
    // 09:00 the day before the change is BST (+1); 09:00 after is GMT (+0)
    expect(new Date(fromWallClock(london, "2026-10-24", 540)).toISOString()).toBe(
      "2026-10-24T08:00:00.000Z",
    );
    expect(new Date(fromWallClock(london, "2026-10-26", 540)).toISOString()).toBe(
      "2026-10-26T09:00:00.000Z",
    );
  });
});

describe("what 'today' means at the provider", () => {
  // 17:30 UTC: Bangkok is already on the 23rd (00:30); Kathmandu (23:15) and Kolkata (23:00) aren't
  const lateEvening = Date.UTC(2026, 9, 22, 17, 30);

  it("depends on the provider's clock, not the customer's", () => {
    expect(todayIn(bangkok, lateEvening)).toBe("2026-10-23");
    expect(todayIn(kathmandu, lateEvening)).toBe("2026-10-22");
    expect(todayIn(kolkata, lateEvening)).toBe("2026-10-22");
  });

  it("turns dayOffset into a real date from the provider's today", () => {
    expect(dayOffsetToDate(bangkok, lateEvening, 0)).toBe("2026-10-23");
    expect(dayOffsetToDate(kathmandu, lateEvening, 0)).toBe("2026-10-22");
    expect(dayOffsetToDate(kathmandu, lateEvening, 3)).toBe("2026-10-25");
  });
});

describe("labels", () => {
  it("uses modern city names even when ICU reports the old ones", () => {
    expect(zoneCity({ kind: "iana", id: "Asia/Katmandu" })).toBe("Kathmandu");
    expect(zoneCity(kolkata)).toBe("Kolkata");
    expect(zoneCity({ kind: "offset", minutes: 345 })).toBe("UTC+5:45");
  });

  it("treats aliases and equal offsets as the same clock", () => {
    expect(sameClock({ kind: "iana", id: "Asia/Katmandu" }, kathmandu, at)).toBe(true);
    expect(sameClock(bangkok, kathmandu, at)).toBe(false);
  });
});
