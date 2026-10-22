import type { PlainDate, Weekday } from "./plain-date";
import type { Consultation, OpeningHours } from "./slots";
import type { ResolvedZone } from "./timezone";

export interface Specialist {
  id: string;
  name: string;
  speciality: string;
  consultation: Consultation;
}

export interface Closure {
  date: PlainDate;
  reason: string;
}

/** A provider as the booking UI needs it (normalised from the API). */
export interface Provider {
  id: number;
  name: string;
  country: string | null;
  timeZone: ResolvedZone;
  /** Missing weekday = closed that day. */
  schedule: Partial<Record<Weekday, OpeningHours>>;
  closures: Closure[];
  specialists: Specialist[];
}

export const MAX_PEOPLE = 4;
export const BOOKING_WINDOW_DAYS = 90;
