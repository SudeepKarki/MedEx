"use client";

import { ArrowRightIcon, CalendarX2Icon, InfoIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DayStatus, SpecialistDay } from "../domain/availability";
import { formatClock, formatPlainDate, toClock, type PlainDate } from "../domain/plain-date";
import { toWallClock } from "../domain/timezone";
import type { Provider, Specialist } from "../domain/types";
import type { Clocks } from "../hooks/use-clocks";
import type { SlotChoice } from "../hooks/selection";
import { slotGroups } from "../hooks/slot-options";
import { SlotListbox } from "./slot-listbox";

export interface DaySuggestions {
  /** Next date (after this one) with a bookable time for the current choices. */
  nextDate: PlainDate | null;
  /** When the chosen specialist has nothing in the window: others who do. */
  otherSpecialists: { specialist: Specialist; nextAvailable: PlainDate }[];
  /** The chosen specialist has no bookable time anywhere in the 90 days. */
  specialistHasNone: boolean;
}

/**
 * The times for the chosen date: one listbox per specialist (just one when a
 * specialist is chosen), each followed by why some of their advertised hours
 * aren't offered. If nothing can be booked, says why and offers a way on.
 */
export function SlotPanel({
  provider,
  date,
  status,
  specialists,
  people,
  selected,
  clocks,
  disabled,
  suggestions,
  onChoose,
  onPickDate,
  onPickSpecialist,
}: {
  provider: Provider;
  date: PlainDate;
  status: DayStatus;
  specialists: SpecialistDay[];
  people: number;
  selected: SlotChoice | null;
  clocks: Clocks;
  disabled: boolean;
  suggestions: DaySuggestions;
  onChoose: (choice: SlotChoice) => void;
  onPickDate: (date: PlainDate) => void;
  onPickSpecialist: (specialistId: string, date: PlainDate) => void;
}) {
  if (status.kind !== "available") {
    return (
      <EmptyDay
        provider={provider}
        date={date}
        status={status}
        people={people}
        clocks={clocks}
        specialists={specialists}
        suggestions={suggestions}
        disabled={disabled}
        onPickDate={onPickDate}
        onPickSpecialist={onPickSpecialist}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {specialists.map((day) => {
        const groups = slotGroups(day, { people, selected, dual: clocks.dual, date });
        const free = day.slots.filter((s) => s.bookable).length;
        return (
          <section key={day.specialist.id} aria-labelledby={`sp-${day.specialist.id}`} className="flex flex-col gap-3">
            {specialists.length > 1 && (
              <h4 id={`sp-${day.specialist.id}`} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-semibold">{day.specialist.name}</span>
                <span className="text-muted-foreground">
                  {day.specialist.speciality} · {free === 0 ? "nothing free" : `${free} free`}
                </span>
              </h4>
            )}
            {specialists.length === 1 && (
              <h4 id={`sp-${day.specialist.id}`} className="sr-only">
                {day.specialist.name}
              </h4>
            )}
            {groups.length > 0 && (
              <SlotListbox
                label={`Times with ${day.specialist.name} on ${formatPlainDate(date, "long")}`}
                groups={groups}
                providerLabel={clocks.providerLabel}
                customerLabel={clocks.customerLabel}
                showCustomer={!clocks.same}
                disabled={disabled}
                onChoose={(option) =>
                  onChoose({ specialistId: option.specialistId, startTime: toClock(option.startMinutes) })
                }
              />
            )}
            {day.explanation && <Note>{day.explanation}</Note>}
          </section>
        );
      })}
      {people > 1 && (
        <Note>
          For {people} people we book {people} appointments back to back with the same specialist, so only start
          times with {people} free times in a row can be chosen.
        </Note>
      )}
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
      <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function EmptyDay({
  provider,
  date,
  status,
  people,
  clocks,
  specialists,
  suggestions,
  disabled,
  onPickDate,
  onPickSpecialist,
}: {
  provider: Provider;
  date: PlainDate;
  status: DayStatus;
  people: number;
  clocks: Clocks;
  specialists: SpecialistDay[];
  suggestions: DaySuggestions;
  disabled: boolean;
  onPickDate: (date: PlainDate) => void;
  onPickSpecialist: (specialistId: string, date: PlainDate) => void;
}) {
  const day = formatPlainDate(date);
  const only = specialists.length === 1 ? specialists[0] : undefined;
  const { title, detail } = explain();

  return (
    <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed bg-card p-5">
      <div className="flex gap-3">
        <CalendarX2Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">{title}</p>
          {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.nextDate && (
          <Button type="button" disabled={disabled} onClick={() => onPickDate(suggestions.nextDate!)}>
            Next free day: {formatPlainDate(suggestions.nextDate)}
            <ArrowRightIcon aria-hidden />
          </Button>
        )}
        {suggestions.otherSpecialists.map(({ specialist, nextAvailable }) => (
          <Button
            key={specialist.id}
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => onPickSpecialist(specialist.id, nextAvailable)}
          >
            {specialist.name} ({specialist.speciality}), free {formatPlainDate(nextAvailable)}
          </Button>
        ))}
      </div>
    </div>
  );

  function explain(): { title: string; detail: string | null } {
    if (suggestions.specialistHasNone && only) {
      return {
        title: `${only.specialist.name} has no free times in the next 90 days`,
        detail:
          people > 1
            ? `There's no day with ${people} free times in a row. You could book fewer people, or see another specialist.`
            : "You could see another specialist instead.",
      };
    }
    switch (status.kind) {
      case "closed":
        return { title: `${provider.name} is closed on ${status.weekday}s`, detail: null };
      case "closure":
        return { title: `${provider.name} is closed on ${day}`, detail: `Reason given: ${status.reason}.` };
      case "day-over":
        return {
          title: "No times left today",
          detail: `It's already ${formatClock(toWallClock(clocks.provider, clocks.minute * 60_000).minutes)} there (${clocks.providerLabel} time), and the rest of today's times have started or are booked.`,
        };
      case "fully-booked":
        return { title: `Every time is booked on ${day}`, detail: null };
      case "group-too-big":
        return {
          title: `No ${people} back-to-back times on ${day}`,
          detail: `A booking for ${people} needs ${people} free times in a row with the same specialist. There are free times, but not ${people} together.`,
        };
      case "specialist-off":
        return { title: `No times inside opening hours on ${day}`, detail: status.detail };
      case "past":
        return { title: `${day} has passed`, detail: `It's already later than that at ${provider.name}.` };
      case "not-open-yet":
        return { title: `Bookings for ${day} aren't open yet`, detail: "You can book up to 90 days ahead." };
      case "available":
        return { title: "", detail: null };
    }
  }
}

export function SlotsSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      {[6, 4].map((count, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(6.75rem,1fr))] gap-2">
            {Array.from({ length: count }, (_, j) => (
              <Skeleton key={j} className="h-14" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

