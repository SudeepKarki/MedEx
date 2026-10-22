"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { bookingWindow, statusLabel, type DayStatus } from "../domain/availability";
import { addDays, compareDates, formatPlainDate, WEEKDAYS, weekdayOf, type PlainDate } from "../domain/plain-date";

export interface CalendarDay {
  date: PlainDate;
  status: DayStatus;
}

type Tone = "available" | "few" | "full" | "closed" | "outside";

function toneOf(status: DayStatus | undefined): Tone {
  switch (status?.kind) {
    case "available":
      return status.bookableStarts <= 3 ? "few" : "available";
    case "closed":
    case "closure":
      return "closed";
    case "fully-booked":
    case "day-over":
    case "group-too-big":
    case "specialist-off":
      return "full";
    default:
      return "outside";
  }
}

const monthStart = (date: PlainDate) => `${date.slice(0, 7)}-01`;
function daysInMonth(date: PlainDate) {
  const [y, m] = date.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
const monthEnd = (date: PlainDate) => addDays(monthStart(date), daysInMonth(date) - 1);
function addMonths(date: PlainDate, delta: number): PlainDate {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const first = new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 10);
  return addDays(first, Math.min(d, daysInMonth(first)) - 1);
}
const clamp = (date: PlainDate, min: PlainDate, max: PlainDate) =>
  compareDates(date, min) < 0 ? min : compareDates(date, max) > 0 ? max : date;

const monthFormatter = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const formatMonth = (date: PlainDate) => monthFormatter.format(new Date(`${date}T00:00:00Z`));

/** Why a day can or can't be booked, for its label and the line under the grid. */
function describe(date: PlainDate, status: DayStatus | undefined, bounds: { first: PlainDate; last: PlainDate }) {
  if (status) return statusLabel(status);
  if (compareDates(date, bounds.first) < 0) return statusLabel({ kind: "past" });
  if (compareDates(date, bounds.last) > 0) return statusLabel({ kind: "not-open-yet" });
  return "Loading…";
}

/**
 * The 90-day calendar, as an ARIA grid (the APG date-picker pattern): one tab
 * stop, arrows move by day/week, Home/End to the week's ends, PageUp/PageDown
 * by month. Unavailable days stay focusable so a screen reader hears *why*
 * ("Closed on Sundays"); sighted customers get the same reason on hover/tap,
 * in the line under the grid, plus a pattern and strike-through, not just colour.
 */
export function BookingCalendar({
  days,
  today,
  selected,
  onSelect,
  marked,
  updating = false,
  disabled = false,
  labelledBy,
}: {
  days: readonly CalendarDay[];
  /** Today at the provider. */
  today: PlainDate;
  selected: PlainDate | null;
  onSelect: (date: PlainDate) => void;
  /** e.g. the appointment being rescheduled */
  marked?: { date: PlainDate; label: string } | null;
  updating?: boolean;
  disabled?: boolean;
  labelledBy: string;
}) {
  const bounds = bookingWindow(today);
  const rangeStart = monthStart(bounds.first);
  const rangeEnd = monthEnd(bounds.last);
  const statuses = new Map(days.map((d) => [d.date, d.status]));
  const firstAvailable = days.find((d) => d.status.kind === "available")?.date ?? bounds.first;

  const [focused, setFocused] = useState<PlainDate>(selected ?? firstAvailable);
  const [inspected, setInspected] = useState<PlainDate | null>(null);
  // Follow selections made elsewhere (e.g. "Go to next free day")
  const [lastSelected, setLastSelected] = useState(selected);
  if (selected !== lastSelected) {
    setLastSelected(selected);
    if (selected) setFocused(selected);
  }

  const gridRef = useRef<HTMLTableElement>(null);
  const moveFocus = useRef(false);
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-date="${focused}"]`)?.focus();
  }, [focused]);

  const month = monthStart(focused);
  const leading = WEEKDAYS.indexOf(weekdayOf(month));
  const count = daysInMonth(month);
  const weeks = Math.ceil((leading + count) / 7);
  const headingId = useId();

  const go = (date: PlainDate, focus: boolean) => {
    moveFocus.current = focus;
    setFocused(clamp(date, rangeStart, rangeEnd));
  };

  const choose = (date: PlainDate) => {
    setInspected(date);
    if (!disabled && statuses.get(date)?.kind === "available") onSelect(date);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const weekday = WEEKDAYS.indexOf(weekdayOf(focused));
    const moves: Record<string, () => PlainDate> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      Home: () => addDays(focused, -weekday),
      End: () => addDays(focused, 6 - weekday),
      PageUp: () => addMonths(focused, -1),
      PageDown: () => addMonths(focused, 1),
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      const next = move();
      go(next, true);
      setInspected(clamp(next, rangeStart, rangeEnd));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(focused);
    }
  };

  const shown = inspected ?? selected;
  const canGoBack = compareDates(month, rangeStart) > 0;
  const canGoForward = compareDates(monthEnd(month), rangeEnd) < 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id={headingId} className="font-heading text-base font-semibold" aria-live="polite">
          {formatMonth(month)}
        </h3>
        <div className="flex items-center gap-1">
          {updating && <span className="mr-2 text-xs text-muted-foreground">Updating…</span>}
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous month"
            disabled={!canGoBack}
            onClick={() => go(addMonths(focused, -1), false)}
          >
            <ChevronLeftIcon aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next month"
            disabled={!canGoForward}
            onClick={() => go(addMonths(focused, 1), false)}
          >
            <ChevronRightIcon aria-hidden />
          </Button>
        </div>
      </div>

      <table
        ref={gridRef}
        role="grid"
        aria-labelledby={`${labelledBy} ${headingId}`}
        aria-busy={updating || undefined}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        className={cn("w-full table-fixed border-separate border-spacing-1 transition-opacity", updating && "opacity-60")}
      >
        <thead>
          <tr>
            {WEEKDAYS.map((day) => (
              <th key={day} scope="col" abbr={day} className="pb-1 text-xs font-medium text-muted-foreground capitalize">
                {day.slice(0, 3)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: weeks }, (_, week) => (
            <tr key={week}>
              {Array.from({ length: 7 }, (_, col) => {
                const n = week * 7 + col - leading + 1;
                if (n < 1 || n > count) return <td key={col} role="presentation" />;
                const date = addDays(month, n - 1);
                const status = statuses.get(date);
                const tone = toneOf(status);
                const isSelected = date === selected;
                const isToday = date === today;
                const isMarked = marked?.date === date;
                const reason = describe(date, status, bounds);
                const label = [
                  formatPlainDate(date, "long"),
                  isToday ? "today" : null,
                  isMarked ? marked.label : null,
                  reason,
                ]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <td
                    key={col}
                    role="gridcell"
                    data-date={date}
                    tabIndex={date === focused ? 0 : -1}
                    aria-selected={isSelected}
                    aria-disabled={tone === "available" || tone === "few" ? undefined : true}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={label}
                    title={reason}
                    onClick={() => {
                      go(date, false);
                      choose(date);
                    }}
                    onMouseEnter={() => setInspected(date)}
                    onFocus={() => {
                      // However focus got here (Tab, a screen reader's cursor, a script), this is now the active day
                      setFocused(date);
                      setInspected(date);
                    }}
                    className="group cursor-pointer p-0 outline-none"
                  >
                    <div
                      className={cn(
                        "relative flex h-11 flex-col items-center justify-center rounded-md border text-sm tabular-nums transition-colors group-focus-visible:ring-3 group-focus-visible:ring-ring/60",
                        tone === "available" || tone === "few"
                          ? "border-border bg-card font-medium hover:border-primary"
                          : "border-transparent text-muted-foreground",
                        tone === "full" && "bg-muted/60 line-through decoration-muted-foreground/70",
                        tone === "closed" &&
                          "bg-[repeating-linear-gradient(135deg,transparent_0_5px,var(--color-border)_5px_6px)]",
                        tone === "outside" && "opacity-50",
                        isToday && !isSelected && "border-primary/70",
                        isSelected && "border-primary bg-primary text-primary-foreground no-underline",
                      )}
                    >
                      <span aria-hidden>{n}</span>
                      {(tone === "available" || tone === "few") && (
                        <span
                          aria-hidden
                          className={cn(
                            "mt-0.5 size-1.5 rounded-full",
                            isSelected ? "bg-primary-foreground" : tone === "few" ? "bg-warning" : "bg-success",
                          )}
                        />
                      )}
                      {isMarked && (
                        <span
                          aria-hidden
                          className="absolute -top-1 -right-1 size-2.5 rotate-45 rounded-[2px] border border-card bg-warning-foreground"
                        />
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="min-h-5 text-sm" aria-hidden>
        {shown && (
          <>
            <span className="font-medium">{formatPlainDate(shown)}</span>
            <span className="text-muted-foreground"> · {describe(shown, statuses.get(shown), bounds)}</span>
          </>
        )}
      </p>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Calendar key">
        <Legend swatch={<span className="size-1.5 rounded-full bg-success" />}>Free times</Legend>
        <Legend swatch={<span className="size-1.5 rounded-full bg-warning" />}>A few left</Legend>
        <Legend swatch={<span className="text-[10px] line-through">12</span>} box="bg-muted/60">
          Fully booked
        </Legend>
        <Legend box="bg-[repeating-linear-gradient(135deg,transparent_0_3px,var(--color-border)_3px_4px)]">Closed</Legend>
        {marked && (
          <Legend swatch={<span className="size-2 rotate-45 rounded-[2px] bg-warning-foreground" />}>{marked.label}</Legend>
        )}
      </ul>
    </div>
  );
}

function Legend({ swatch, box, children }: { swatch?: ReactNode; box?: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden className={cn("flex size-5 items-center justify-center rounded border", box)}>
        {swatch}
      </span>
      {children}
    </li>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-36" />
        <div className="flex gap-1">
          <Skeleton className="size-9" />
          <Skeleton className="size-9" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={`h${i}`} className="mx-auto mb-1 h-3 w-6" />
        ))}
        {Array.from({ length: 35 }, (_, i) => (
          <Skeleton key={i} className="h-11" />
        ))}
      </div>
    </div>
  );
}
