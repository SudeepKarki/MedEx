import { addDays, compareDates, formatPlainDate, weekdayOf, type PlainDate } from "./plain-date";
import { groupStarts, hoursExplanation, planSlots, type PlannedSlot, type SlotPlan } from "./slots";
import { BOOKING_WINDOW_DAYS, type Provider, type Specialist } from "./types";

/** "Now" on the provider's clock. Everything time-relative is measured by it. */
export interface ProviderNow {
  today: PlainDate;
  minutes: number;
}

export type SlotState = "free" | "booked" | "started" | "current";

export interface SlotView extends PlannedSlot {
  specialistId: string;
  state: SlotState;
  /** Can start a booking for the chosen number of people. */
  bookable: boolean;
}

export interface SpecialistDay {
  specialist: Specialist;
  plan: SlotPlan;
  slots: SlotView[];
  /** Why some advertised hours aren't bookable today (null if all are). */
  explanation: string | null;
}

export type DayStatus =
  | { kind: "available"; bookableStarts: number }
  | { kind: "past" }
  | { kind: "not-open-yet" }
  | { kind: "closure"; reason: string }
  | { kind: "closed"; weekday: string }
  | { kind: "specialist-off"; detail: string }
  | { kind: "day-over" }
  | { kind: "fully-booked" }
  | { kind: "group-too-big"; people: number };

export interface DayInput {
  provider: Provider;
  date: PlainDate;
  now: ProviderNow;
  /** null = any specialist */
  specialistId: string | null;
  people: number;
  /** "specialistId|HH:MM" taken on this date (by anyone). */
  booked: ReadonlySet<string>;
  /** The customer's own slots when rescheduling: shown as theirs, freed by the move. */
  current?: ReadonlySet<string>;
}

export const slotKey = (specialistId: string, startMinutes: number) =>
  `${specialistId}|${String(Math.floor(startMinutes / 60)).padStart(2, "0")}:${String(startMinutes % 60).padStart(2, "0")}`;

export function bookingWindow(today: PlainDate) {
  return { first: today, last: addDays(today, BOOKING_WINDOW_DAYS - 1) };
}

/**
 * Everything about one date for one (or any) specialist: each slot's state,
 * which start times fit the group, and, if nothing can be booked, the single
 * most useful reason why.
 */
export function describeDay(input: DayInput): { status: DayStatus; specialists: SpecialistDay[] } {
  const { provider, date, now, people } = input;
  const window = bookingWindow(now.today);
  const weekday = weekdayOf(date);
  const weekdayLabel = formatPlainDate(date, "weekday");
  const opening = provider.schedule[weekday] ?? null;
  const closure = provider.closures.find((c) => c.date === date);
  const isToday = date === now.today;

  const chosen = provider.specialists.filter(
    (s) => !input.specialistId || s.id === input.specialistId,
  );
  const specialists: SpecialistDay[] = chosen.map((specialist) => {
    const plan = planSlots(specialist.consultation, closure ? null : opening);
    const stateOf = (slot: PlannedSlot): SlotState => {
      const key = slotKey(specialist.id, slot.startMinutes);
      if (input.current?.has(key)) return "current";
      if (input.booked.has(key)) return "booked";
      // A slot that has started (by the provider's clock) can't be booked
      if (isToday && slot.startMinutes <= now.minutes) return "started";
      return "free";
    };
    const states = new Map(plan.offered.map((s) => [s.index, stateOf(s)]));
    // Your own current slots are freed by the move, so they count as free for a group
    const starts = groupStarts(
      plan.offered,
      (s) => states.get(s.index) === "free" || states.get(s.index) === "current",
      people,
    );
    return {
      specialist,
      plan,
      explanation: closure
        ? null
        : hoursExplanation(specialist.name, specialist.consultation, opening, weekdayLabel, plan),
      slots: plan.offered.map((s) => ({
        ...s,
        specialistId: specialist.id,
        state: states.get(s.index)!,
        bookable: starts.has(s.index) && states.get(s.index) === "free",
      })),
    };
  });

  return { status: statusOf(), specialists };

  function statusOf(): DayStatus {
    if (compareDates(date, window.first) < 0) return { kind: "past" };
    if (compareDates(date, window.last) > 0) return { kind: "not-open-yet" };
    if (closure) return { kind: "closure", reason: closure.reason };
    if (!opening) return { kind: "closed", weekday: weekdayLabel };
    const bookable = specialists.reduce((n, d) => n + d.slots.filter((s) => s.bookable).length, 0);
    if (bookable > 0) return { kind: "available", bookableStarts: bookable };
    if (specialists.every((d) => d.plan.offered.length === 0)) {
      return {
        kind: "specialist-off",
        detail:
          specialists.length === 1
            ? (specialists[0]!.explanation ?? "No consultation hours this day.")
            : `None of the specialists' hours fall within opening hours on ${weekdayLabel}s.`,
      };
    }
    const slots = specialists.flatMap((d) => d.slots);
    const open = slots.filter((s) => s.state === "free" || s.state === "current");
    if (open.length === 0) {
      return isToday &&
        slots.some((s) => s.state === "started") &&
        !slots.every((s) => s.state === "booked")
        ? { kind: "day-over" }
        : { kind: "fully-booked" };
    }
    return { kind: "group-too-big", people };
  }
}

/** Short reason for a calendar day, for its label and tooltip. */
export function statusLabel(status: DayStatus): string {
  switch (status.kind) {
    case "available":
      return `${status.bookableStarts} ${status.bookableStarts === 1 ? "time" : "times"} available`;
    case "past":
      return "In the past";
    case "not-open-yet":
      return `Bookings open ${BOOKING_WINDOW_DAYS} days ahead`;
    case "closure":
      return `Closed: ${status.reason}`;
    case "closed":
      return `Closed on ${status.weekday}s`;
    case "specialist-off":
      return "No consultation hours";
    case "day-over":
      return "No times left today";
    case "fully-booked":
      return "Fully booked";
    case "group-too-big":
      return `No ${status.people} back-to-back times`;
  }
}

/** First date from `from` (inclusive) within the window that has a bookable time. */
export function nextAvailableDate(
  days: readonly { date: PlainDate; status: DayStatus }[],
  from: PlainDate,
): PlainDate | null {
  return (
    days.find((d) => compareDates(d.date, from) >= 0 && d.status.kind === "available")?.date ?? null
  );
}
