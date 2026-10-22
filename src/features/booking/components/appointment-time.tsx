import { UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClock, formatPlainDate, parseClock, type PlainDate } from "../domain/plain-date";
import { formatCustomerTime } from "../domain/two-clocks";
import type { Specialist } from "../domain/types";
import type { Clocks } from "../hooks/use-clocks";

/**
 * A date and time as the customer must read it: the provider's clock first,
 * labelled with the place, then their own clock, labelled "your time". Every
 * appointment time on a summary goes through this, so it's always both and
 * always labelled.
 */
export function AppointmentTime({
  date,
  startTime,
  clocks,
  className,
  struck = false,
}: {
  date: PlainDate;
  startTime: string;
  clocks: Clocks;
  className?: string;
  struck?: boolean;
}) {
  const minutes = parseClock(startTime) ?? 0;
  const time = clocks.dual(date, minutes);
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <p className={cn("font-heading text-lg font-semibold", struck && "line-through decoration-2")}>
        {formatPlainDate(date)} · {formatClock(minutes)}
        <span className="ml-1.5 text-sm font-normal text-muted-foreground">{clocks.providerCity} time</span>
      </p>
      {!clocks.same && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <UserIcon aria-hidden className="size-3.5 shrink-0" />
          <span>
            {time.dayShift === 0 ? formatClock(time.customer.minutes) : formatCustomerTime(time)} your time in{" "}
            {clocks.customerCity}
          </span>
        </p>
      )}
    </div>
  );
}

/** "3 back-to-back appointments: 10:00, 10:40, 11:20 AM. Finishes 11:50 AM." */
export function GroupRun({ specialist, startTime, people }: { specialist: Specialist; startTime: string; people: number }) {
  if (people < 2) return null;
  const start = parseClock(startTime) ?? 0;
  const step = specialist.consultation.durationMinutes + specialist.consultation.bufferMinutes;
  const starts = Array.from({ length: people }, (_, k) => start + k * step);
  const end = starts[starts.length - 1]! + specialist.consultation.durationMinutes;
  return (
    <p className="text-sm text-muted-foreground">
      {people} appointments back to back: {starts.map(formatClock).join(", ")}. The last one finishes at{" "}
      {formatClock(end)}.
    </p>
  );
}
