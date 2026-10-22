import { z } from "zod";
import { isPlainDate, parseClock, type PlainDate } from "../domain/plain-date";
import { MAX_PEOPLE } from "../domain/types";

export interface SlotChoice {
  specialistId: string;
  /** "HH:MM" on the provider's clock */
  startTime: string;
}

/** Everything the customer has chosen so far. Lives in the form, mirrored into the URL. */
export interface BookingSelection {
  /** null = any specialist */
  specialistId: string | null;
  people: number;
  date: PlainDate | null;
  slot: SlotChoice | null;
}

export const selectionSchema = z
  .object({
    specialistId: z.string().nullable(),
    people: z.number().int().min(1).max(MAX_PEOPLE),
    date: z.string().nullable(),
    slot: z.object({ specialistId: z.string(), startTime: z.string() }).nullable(),
  })
  .refine((v) => v.date !== null && v.slot !== null, { message: "Choose a time to continue.", path: ["slot"] });

/** Reads ?specialist=&people=&date=&time=&with= leniently: anything unreadable is simply not chosen. */
export function selectionFromSearch(params: URLSearchParams): BookingSelection {
  const specialistId = params.get("specialist") || null;
  const people = Number(params.get("people"));
  const date = params.get("date");
  const time = params.get("time");
  const withId = params.get("with") || specialistId;
  return {
    specialistId,
    people: Number.isInteger(people) && people >= 1 && people <= MAX_PEOPLE ? people : 1,
    date: isPlainDate(date) ? date : null,
    slot: isPlainDate(date) && time && parseClock(time) !== null && withId ? { specialistId: withId, startTime: time } : null,
  };
}

export function selectionToSearch(selection: BookingSelection): string {
  const params = new URLSearchParams();
  if (selection.specialistId) params.set("specialist", selection.specialistId);
  if (selection.people > 1) params.set("people", String(selection.people));
  if (selection.date) params.set("date", selection.date);
  if (selection.slot) {
    params.set("time", selection.slot.startTime);
    if (selection.slot.specialistId !== selection.specialistId) params.set("with", selection.slot.specialistId);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
