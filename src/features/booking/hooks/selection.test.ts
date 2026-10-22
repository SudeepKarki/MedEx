import { describe, expect, it } from "vitest";
import { selectionFromSearch, selectionToSearch, type BookingSelection } from "./selection";

describe("selection ↔ URL", () => {
  it("round-trips a full selection", () => {
    const selection: BookingSelection = {
      specialistId: null,
      people: 3,
      date: "2026-10-27",
      slot: { specialistId: "wong", startTime: "10:40" },
    };
    const search = selectionToSearch(selection);
    expect(search).toBe("?people=3&date=2026-10-27&time=10%3A40&with=wong");
    expect(selectionFromSearch(new URLSearchParams(search))).toEqual(selection);
  });

  it("ignores values it can't read instead of failing", () => {
    expect(selectionFromSearch(new URLSearchParams("people=9&date=27/10/2026&time=25:00"))).toEqual({
      specialistId: null,
      people: 1,
      date: null,
      slot: null,
    });
  });
});
