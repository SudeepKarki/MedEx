import type { ApiSlot, Availability } from "../api/client";
import { closestAlternatives, type Alternative } from "../domain/alternatives";
import { nextAvailableDate, slotKeyOf, type SlotView, type SpecialistDay } from "../domain/availability";
import { addDays, formatClock, parseClock, toClock, type PlainDate } from "../domain/plain-date";
import type { Provider, Specialist } from "../domain/types";
import type { SlotChoice } from "./selection";

/**
 * Small pure helpers the booking flow derives its view from. Kept out of the
 * component so each rule can be read (and tested) on its own.
 */

/** The `/slots` response → the set of taken slot keys `describeDay` expects. */
export const bookedKeys = (slots: readonly ApiSlot[]) =>
  new Set(slots.filter((s) => s.isBooked).map((s) => slotKeyOf(s.specialistId, s.startTime)));

export function findSlot(day: readonly SpecialistDay[], choice: SlotChoice): SlotView | undefined {
  return day.find((d) => d.specialist.id === choice.specialistId)?.slots.find((s) => toClock(s.startMinutes) === choice.startTime);
}

/** Why the chosen time can't be booked (any more), or null if it can. */
export function slotProblem(choice: SlotChoice, slot: SlotView | undefined, people: number): string | null {
  const time = formatClock(parseClock(choice.startTime) ?? 0);
  if (!slot) return `${time} isn't offered on this day. Choose another time.`;
  if (slot.bookable) return null;
  switch (slot.state) {
    case "booked":
      return `${time} has just been booked by someone else. Choose another time.`;
    case "started":
      return `${time} has already started. Choose a later time.`;
    case "current":
      return `${time} is your current appointment. Choose a different time to move it.`;
    case "free":
      return `${time} doesn't have ${people} free times in a row. Choose another start time.`;
  }
}

/** The next bookable day after `from`, else the first one in the window. */
export function nextFreeDay(days: Availability["days"] | undefined, from: PlainDate): PlainDate | null {
  if (!days?.[0]) return null;
  return nextAvailableDate(days, addDays(from, 1)) ?? nextAvailableDate(days, days[0].date);
}

/** Ways forward for a day (or specialist) with nothing to book. */
export function daySuggestions({
  provider,
  date,
  specialistId,
  availability,
  canSwitchSpecialist,
}: {
  provider: Provider;
  date: PlainDate | null;
  specialistId: string | null;
  availability: Availability | undefined;
  canSwitchSpecialist: boolean;
}) {
  const next = availability?.nextAvailable;
  const specialistHasNone = Boolean(specialistId && next && next[specialistId] === null);
  const otherSpecialists: { specialist: Specialist; nextAvailable: PlainDate }[] =
    specialistHasNone && canSwitchSpecialist && next
      ? provider.specialists.flatMap((s) => {
          const nextAvailable = next[s.id];
          return s.id !== specialistId && nextAvailable ? [{ specialist: s, nextAvailable }] : [];
        })
      : [];
  return { nextDate: date ? nextFreeDay(availability?.days, date) : null, specialistHasNone, otherSpecialists };
}

/**
 * After a 409: the closest bookable times to the one that was taken, once the
 * day's slots have been refetched (null while that's still happening).
 */
export function alternativesAfterConflict({
  wanted,
  date,
  day,
  fresh,
  anySpecialist,
}: {
  wanted: { date: PlainDate; slot: SlotChoice } | null;
  date: PlainDate | null;
  day: SpecialistDay[] | null;
  fresh: boolean;
  anySpecialist: boolean;
}): Alternative[] | null {
  if (!wanted || !day || !fresh || wanted.date !== date) return null;
  return closestAlternatives(
    day,
    { specialistId: wanted.slot.specialistId, startMinutes: parseClock(wanted.slot.startTime) ?? 0 },
    { anySpecialist },
  );
}
