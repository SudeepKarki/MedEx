"use client";

import { CalendarClockIcon, CheckCircle2Icon, MapPinIcon, StethoscopeIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Booking, ProviderData } from "../api/client";
import { formatClock, formatPlainDate, isPlainDate, parseClock } from "../domain/plain-date";
import { useBooking, useProvider } from "../hooks/queries";
import { useClocks } from "../hooks/use-clocks";
import { AppointmentTime, GroupRun } from "./appointment-time";
import { describeShift } from "./booking-summary";
import { ClockStrip } from "./clock-strip";
import { isNotFound, NotFound, PageError } from "./routes";

/** /bookings/[bookingId]: the confirmation (after booking or moving) and the way to reschedule. */
export function BookingDetailsRoute() {
  const params = useParams<{ bookingId: string }>();
  const search = useSearchParams();
  const booking = useBooking(decodeURIComponent(params.bookingId));
  const provider = useProvider(booking.data?.providerId ?? 0, booking.data !== undefined);

  if (booking.data && provider.data) {
    const status = search.get("status");
    const [fromDate, fromTime] = (search.get("from") ?? "").split("T");
    const from = isPlainDate(fromDate) && parseClock(fromTime) !== null ? { date: fromDate, startTime: fromTime! } : null;
    return (
      <BookingDetails
        booking={booking.data}
        data={provider.data}
        status={status === "booked" || status === "moved" ? status : null}
        from={status === "moved" ? from : null}
      />
    );
  }
  const failed = booking.error ?? (booking.data ? provider.error : null);
  if (failed) {
    return isNotFound(failed) ? (
      <NotFound title="We couldn't find that booking" />
    ) : (
      <PageError
        error={failed}
        onRetry={() => (booking.error ? booking.refetch() : provider.refetch())}
        retrying={booking.isFetching || provider.isFetching}
        what="your booking"
      />
    );
  }
  return <BookingDetailsSkeleton />;
}

export function BookingDetailsSkeleton() {
  return (
    <div role="status" aria-label="Loading your booking" className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-56 rounded-2xl" />
    </div>
  );
}

function BookingDetails({
  booking,
  data,
  status,
  from,
}: {
  booking: Booking;
  data: ProviderData;
  status: "booked" | "moved" | null;
  from: { date: string; startTime: string } | null;
}) {
  const { provider } = data;
  const clocks = useClocks(provider);
  const specialist = provider.specialists.find((s) => s.id === booking.specialistId);
  const title = status === "booked" ? "You're booked" : status === "moved" ? "Your appointment has moved" : "Your appointment";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-col gap-2">
        {status && (
          <p className="flex items-center gap-2 font-medium text-success">
            <CheckCircle2Icon aria-hidden className="size-5" />
            {status === "booked" ? "Booking confirmed" : "Change confirmed"}
          </p>
        )}
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="text-muted-foreground">
          Booking reference <span className="font-mono font-medium text-foreground">{booking.bookingId}</span>
        </p>
      </header>

      <ClockStrip clocks={clocks} providerName={provider.name} />

      <section aria-labelledby="details-heading" className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
        <h2 id="details-heading" className="flex items-center gap-2 font-heading text-lg font-semibold">
          <CalendarClockIcon aria-hidden className="size-5 text-primary" />
          When
        </h2>
        <AppointmentTime date={booking.date} startTime={booking.startTime} clocks={clocks} />
        {from && (
          <p className="text-sm text-muted-foreground">
            Moved from{" "}
            <AppointmentTimeInline date={from.date} startTime={from.startTime} /> ·{" "}
            {describeShift(from, { date: booking.date, startTime: booking.startTime })}.
          </p>
        )}
        {specialist && <GroupRun specialist={specialist} startTime={booking.startTime} people={booking.numberOfPeople} />}
        <dl className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-3">
          <Detail icon={<MapPinIcon aria-hidden className="size-4" />} label="Where" value={provider.name} />
          <Detail
            icon={<StethoscopeIcon aria-hidden className="size-4" />}
            label="With"
            value={specialist ? `${specialist.name}, ${specialist.speciality}` : "Your specialist"}
          />
          <Detail
            icon={<UsersIcon aria-hidden className="size-4" />}
            label="For"
            value={booking.numberOfPeople === 1 ? "1 person" : `${booking.numberOfPeople} people`}
          />
        </dl>
        <p className="text-sm text-muted-foreground">
          Please arrive by {clocks.providerCity} time. Your phone may show a different time if it&apos;s still set to{" "}
          {clocks.same ? "another zone" : clocks.customerCity}.
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href={`/bookings/${encodeURIComponent(booking.bookingId)}/reschedule`}>Change date or time</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href={`/book/${provider.id}`}>Book another appointment</Link>
        </Button>
      </div>
    </div>
  );
}

function AppointmentTimeInline({ date, startTime }: { date: string; startTime: string }) {
  return <span className="line-through">{`${formatPlainDate(date)}, ${formatClock(parseClock(startTime) ?? 0)}`}</span>;
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
