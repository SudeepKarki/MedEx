"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isApiError } from "@/lib/api/errors";
import { selectionFromSearch } from "../hooks/selection";
import { useBooking, useProvider } from "../hooks/queries";
import { BookingFlow } from "./booking-flow";
import { BookingPageSkeleton } from "./page-skeleton";
import { InlineError } from "./states";

/** /book/[providerId] */
export function BookRoute() {
  const params = useParams<{ providerId: string }>();
  const search = useSearchParams();
  const providerId = Number(params.providerId);
  const provider = useProvider(providerId);

  if (provider.data) {
    return <BookingFlow data={provider.data} mode={{ kind: "new" }} initial={selectionFromSearch(new URLSearchParams(search))} />;
  }
  if (provider.isError) {
    return isNotFound(provider.error) ? (
      <NotFound title="We couldn't find that provider" />
    ) : (
      <PageError error={provider.error} onRetry={() => provider.refetch()} retrying={provider.isFetching} what="this provider" />
    );
  }
  return <BookingPageSkeleton />;
}

/** /bookings/[bookingId]/reschedule */
export function RescheduleRoute() {
  const params = useParams<{ bookingId: string }>();
  const search = useSearchParams();
  const booking = useBooking(decodeURIComponent(params.bookingId));
  const provider = useProvider(booking.data?.providerId ?? 0, booking.data !== undefined);
  const enabledProvider = booking.data ? provider : null;

  if (booking.data && enabledProvider?.data) {
    const fromUrl = selectionFromSearch(new URLSearchParams(search));
    return (
      <BookingFlow
        key={booking.data.bookingId}
        data={enabledProvider.data}
        mode={{ kind: "reschedule", booking: booking.data }}
        initial={{
          specialistId: null,
          people: booking.data.numberOfPeople,
          date: fromUrl.date,
          slot: fromUrl.slot && { specialistId: booking.data.specialistId, startTime: fromUrl.slot.startTime },
        }}
      />
    );
  }
  const failed = booking.error ?? enabledProvider?.error;
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
  return <BookingPageSkeleton />;
}

export const isNotFound = (error: unknown) => isApiError(error) && error.status === 404;

export function NotFound({ title }: { title: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-16">
      <h1 className="font-heading text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">The link may be old or mistyped.</p>
      <Button asChild>
        <Link href="/book">See providers</Link>
      </Button>
    </div>
  );
}

export function PageError(props: { error: unknown; onRetry: () => void; retrying: boolean; what: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-16">
      <h1 className="font-heading text-2xl font-semibold">Something went wrong</h1>
      <InlineError {...props} />
    </div>
  );
}
