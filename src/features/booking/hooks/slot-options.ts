import { slotKey, type SpecialistDay } from "../domain/availability";
import { toClock, type PlainDate } from "../domain/plain-date";
import { groupIndices, periodOf, type Period } from "../domain/slots";
import type { DualTime } from "../domain/two-clocks";
import type { SlotGroup, SlotOption } from "../components/slot-listbox";
import type { SlotChoice } from "./selection";

const PERIODS: Period[] = ["morning", "afternoon", "evening"];

/** One specialist's day → listbox options grouped by period, with the reason any can't be chosen. */
export function slotGroups(
  day: SpecialistDay,
  context: {
    people: number;
    selected: SlotChoice | null;
    dual: (date: PlainDate, minutes: number) => DualTime;
    date: PlainDate;
  },
): SlotGroup[] {
  const { people, selected } = context;
  const start =
    selected?.specialistId === day.specialist.id
      ? day.slots.find((s) => toClock(s.startMinutes) === selected.startTime && s.bookable)
      : undefined;
  const run = new Set(start ? groupIndices(start.index, people).slice(1) : []);

  const options: SlotOption[] = day.slots.map((slot) => {
    const reasons: Record<string, [string, string]> = {
      booked: ["Booked", "booked"],
      started: ["Started", "already started"],
      current: ["Your booking", "your current appointment"],
      free: [`Not ${people} in a row`, `free, but there aren't ${people} free times in a row from here`],
    };
    const [reason, spokenReason] = slot.bookable
      ? [null, slot.state === "current" ? "part of your current appointment" : null]
      : (reasons[slot.state] ?? [null, null]);
    return {
      key: slotKey(day.specialist.id, slot.startMinutes),
      specialistId: day.specialist.id,
      startMinutes: slot.startMinutes,
      state: slot.state,
      selectable: slot.bookable,
      reason,
      spokenReason,
      time: context.dual(context.date, slot.startMinutes),
      selected: slot === start,
      inRun: run.has(slot.index),
    };
  });

  return PERIODS.map((period) => ({ period, options: options.filter((o) => periodOf(o.startMinutes) === period) })).filter(
    (g) => g.options.length > 0,
  );
}
