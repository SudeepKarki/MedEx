import { formatClock } from "./plain-date";

export interface Consultation {
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  bufferMinutes: number;
}

/** The provider's opening hours on one day; null when it's closed that day. */
export interface OpeningHours {
  openMinutes: number;
  closeMinutes: number;
}

export interface PlannedSlot {
  /** Position in the specialist's grid (0 = consultation start). Consecutive = adjacent indices. */
  index: number;
  startMinutes: number;
  endMinutes: number;
}

export interface SlotPlan {
  /** Inside both the consultation hours and the opening hours: bookable in principle. */
  offered: PlannedSlot[];
  /** On the specialist's grid but outside opening hours: advertised, not bookable. */
  outsideHours: PlannedSlot[];
}

/**
 * The slot rule from the brief: slots start at the consultation start and
 * repeat every duration + buffer; the last one is the last that still *ends*
 * by the consultation end. A slot is offered only if it lies entirely inside
 * the provider's opening hours that day.
 *
 * The grid stays anchored to the consultation start even when opening hours
 * cut it: 07:00 with 45 + 15 gives 07:00, 08:00, 09:00… so a hospital opening
 * at 08:00 offers 08:00 onwards, never a re-aligned 08:15.
 */
export function planSlots(consultation: Consultation, opening: OpeningHours | null): SlotPlan {
  const { startMinutes, endMinutes, durationMinutes, bufferMinutes } = consultation;
  const step = durationMinutes + bufferMinutes;
  const offered: PlannedSlot[] = [];
  const outsideHours: PlannedSlot[] = [];
  if (durationMinutes <= 0 || bufferMinutes < 0 || step <= 0) return { offered, outsideHours };

  for (
    let index = 0, start = startMinutes;
    start + durationMinutes <= endMinutes;
    index++, start += step
  ) {
    const slot = { index, startMinutes: start, endMinutes: start + durationMinutes };
    const inside =
      opening !== null && start >= opening.openMinutes && slot.endMinutes <= opening.closeMinutes;
    (inside ? offered : outsideHours).push(slot);
  }
  return { offered, outsideHours };
}

/**
 * Start indices where `people` appointments fit back to back with the same
 * specialist: slots k, k+1, … k+people−1 must all be offered and free.
 * Consecutive means adjacent on the grid (buffers in between are fine);
 * a booked or out-of-hours slot breaks the run.
 */
export function groupStarts(
  offered: readonly PlannedSlot[],
  isFree: (slot: PlannedSlot) => boolean,
  people: number,
): Set<number> {
  const freeByIndex = new Map(offered.filter(isFree).map((s) => [s.index, s]));
  const starts = new Set<number>();
  for (const slot of freeByIndex.values()) {
    let fits = true;
    for (let k = 1; k < people; k++) {
      if (!freeByIndex.has(slot.index + k)) {
        fits = false;
        break;
      }
    }
    if (fits) starts.add(slot.index);
  }
  return starts;
}

/** The grid indices a group booking starting at `index` occupies. */
export function groupIndices(index: number, people: number): number[] {
  return Array.from({ length: people }, (_, k) => index + k);
}

export type Period = "morning" | "afternoon" | "evening";

/** Before noon, noon to 5 PM, after 5 PM, on the provider's clock. */
export function periodOf(startMinutes: number): Period {
  if (startMinutes < 12 * 60) return "morning";
  if (startMinutes < 17 * 60) return "afternoon";
  return "evening";
}

export const PERIOD_LABELS: Record<Period, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

/**
 * Why some of a specialist's advertised hours can't be booked on a day, in
 * one sentence, or null when they all can. E.g. "Dr. N. Rana sees patients
 * 6:00 PM – 9:00 PM, but the hospital closes at 8:00 PM on Mondays, so
 * bookings end at 8:00 PM."
 */
export function hoursExplanation(
  specialist: string,
  consultation: Consultation,
  opening: OpeningHours | null,
  weekdayLabel: string,
  plan: SlotPlan,
): string | null {
  const advertised = `${specialist} sees patients ${formatClock(consultation.startMinutes)} – ${formatClock(consultation.endMinutes)}`;
  if (!opening) return `${advertised}, but the provider is closed on ${weekdayLabel}s.`;
  if (plan.outsideHours.length === 0) return null;
  if (plan.offered.length === 0) {
    return `${advertised}, but on ${weekdayLabel}s the provider is only open ${formatClock(opening.openMinutes)} – ${formatClock(opening.closeMinutes)}, so there are no times to book.`;
  }
  const first = plan.offered[0]!;
  const last = plan.offered[plan.offered.length - 1]!;
  const parts: string[] = [];
  if (consultation.startMinutes < opening.openMinutes)
    parts.push(`opens at ${formatClock(opening.openMinutes)}`);
  if (consultation.endMinutes > opening.closeMinutes)
    parts.push(`closes at ${formatClock(opening.closeMinutes)}`);
  return `${advertised}, but the provider ${parts.join(" and ")} on ${weekdayLabel}s, so only ${formatClock(first.startMinutes)} – ${formatClock(last.endMinutes)} can be booked.`;
}
