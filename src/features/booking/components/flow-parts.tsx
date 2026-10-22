"use client";

import { WifiOffIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { Booking } from "../api/client";
import type { DayStatus } from "../domain/availability";
import { formatPlainDate, type PlainDate } from "../domain/plain-date";
import type { Provider } from "../domain/types";

export function Step({ n, title, id, note, children }: { n: number; title: string; id: string; note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card/60 p-4 sm:p-5">
      <div className="flex flex-col gap-0.5">
        <h2 id={id} className="flex items-center gap-2.5 font-heading text-lg font-semibold">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground"
          >
            {n}
          </span>
          {title}
        </h2>
        {note && <p className="pl-9.5 text-sm text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * A loading skeleton that says what's going on: offline straight away (the
 * request is waiting for the connection), "slow" after a few seconds.
 */
export function LoadingArea({ label, offline, children }: { label: string; offline: boolean; children: ReactNode }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 2500);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div role="status" aria-label={label} aria-busy className="flex flex-col gap-3">
      {children}
      <p className="flex min-h-5 items-center gap-1.5 text-sm text-muted-foreground">
        {offline ? (
          <>
            <WifiOffIcon aria-hidden className="size-4" />
            You&apos;re offline. This will load as soon as you&apos;re back online.
          </>
        ) : slow ? (
          "Still loading. The connection seems slow…"
        ) : null}
      </p>
    </div>
  );
}

export function CurrentBookingNote({
  provider,
  booking,
  days,
}: {
  provider: Provider;
  booking: Booking;
  days: { date: PlainDate; status: DayStatus }[] | undefined;
}) {
  const specialist = provider.specialists.find((s) => s.id === booking.specialistId);
  const status = days?.find((d) => d.date === booking.date)?.status;
  const closedThatDay = status?.kind === "closed" || status?.kind === "closure";
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        With <span className="font-medium">{specialist?.name ?? "your specialist"}</span>
        {specialist && <span className="text-muted-foreground"> ({specialist.speciality})</span>}, for{" "}
        {booking.numberOfPeople === 1 ? "1 person" : `${booking.numberOfPeople} people`}. You can change the date and
        time; to see someone else, make a new booking.
      </p>
      {closedThatDay && (
        <p className="rounded-lg bg-warning-muted px-3 py-2 text-warning-foreground">
          Your current appointment is on {formatPlainDate(booking.date, "long")}, but {provider.name}&apos;s listed hours
          say it&apos;s closed that day. Your booking still stands; you may want to move it or check with them.
        </p>
      )}
    </div>
  );
}
