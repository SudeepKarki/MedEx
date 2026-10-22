import { daysBetween, formatClock, formatPlainDate, type PlainDate } from "./plain-date";
import { fromWallClock, offsetMinutes, toWallClock, type Zone } from "./timezone";

/** One moment as it reads on both clocks: at the provider (where the customer must be) and at home. */
export interface DualTime {
  instant: number;
  provider: { date: PlainDate; minutes: number };
  customer: { date: PlainDate; minutes: number };
  /** Customer's calendar date minus the provider's: +1 means "the next day for you". */
  dayShift: number;
}

export function dualTime(providerZone: Zone, customerZone: Zone, date: PlainDate, minutes: number): DualTime {
  const instant = fromWallClock(providerZone, date, minutes);
  const customer = toWallClock(customerZone, instant);
  return { instant, provider: { date, minutes }, customer, dayShift: daysBetween(date, customer.date) };
}

/** "next day", "previous day", or null when it's the same calendar day on both clocks. */
export function dayShiftLabel(shift: number): string | null {
  if (shift === 0) return null;
  if (shift === 1) return "next day";
  if (shift === -1) return "previous day";
  return shift > 0 ? `${shift} days later` : `${-shift} days earlier`;
}

export function formatDuration(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h && m) return `${h} h ${m} min`;
  return h ? `${h} h` : `${m} min`;
}

/**
 * How the provider's clock compares with the customer's at a given moment
 * (offsets can differ by date where daylight saving applies).
 */
export function clockGap(providerZone: Zone, customerZone: Zone, at: number): { minutes: number; text: string } {
  const minutes = offsetMinutes(providerZone, at) - offsetMinutes(customerZone, at);
  if (minutes === 0) return { minutes, text: "the same time as you" };
  return { minutes, text: `${formatDuration(minutes)} ${minutes > 0 ? "ahead of" : "behind"} you` };
}

/** "9:25 AM" or "12:30 AM, Fri 23 Oct" when the customer's date differs. */
export function formatCustomerTime(time: DualTime): string {
  const clock = formatClock(time.customer.minutes);
  return time.dayShift === 0 ? clock : `${clock}, ${formatPlainDate(time.customer.date)}`;
}
