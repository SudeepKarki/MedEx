import type { SpecialistDay } from "./availability";

export interface Alternative {
  specialistId: string;
  startMinutes: number;
}

/**
 * After "someone else got there first": the bookable starts nearest the time
 * the customer wanted, so they can pick again without starting over. Same
 * specialist only, unless they chose "any specialist".
 */
export function closestAlternatives(
  day: readonly SpecialistDay[],
  wanted: Alternative,
  options: { anySpecialist: boolean; limit?: number },
): Alternative[] {
  const limit = options.limit ?? 3;
  return day
    .filter((d) => options.anySpecialist || d.specialist.id === wanted.specialistId)
    .flatMap((d) => d.slots.filter((s) => s.bookable).map((s) => ({ specialistId: d.specialist.id, startMinutes: s.startMinutes })))
    .filter((a) => !(a.specialistId === wanted.specialistId && a.startMinutes === wanted.startMinutes))
    .sort(
      (a, b) =>
        Math.abs(a.startMinutes - wanted.startMinutes) - Math.abs(b.startMinutes - wanted.startMinutes) ||
        // Same distance: their specialist first, then the later time (an earlier one may be too soon)
        Number(b.specialistId === wanted.specialistId) - Number(a.specialistId === wanted.specialistId) ||
        b.startMinutes - a.startMinutes,
    )
    .slice(0, limit)
    .sort((a, b) => a.startMinutes - b.startMinutes);
}
