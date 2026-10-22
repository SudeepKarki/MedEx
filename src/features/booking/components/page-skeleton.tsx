import { Skeleton } from "@/components/ui/skeleton";
import { CalendarSkeleton } from "./booking-calendar";
import { SlotsSkeleton } from "./slot-panel";

/** The booking page's shape while the provider loads, so nothing jumps when it arrives. */
export function BookingPageSkeleton() {
  return (
    <div role="status" aria-label="Loading booking page" className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-48 rounded-2xl" />
          <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
            <div className="rounded-2xl border p-5">
              <CalendarSkeleton />
            </div>
            <div className="rounded-2xl border p-5">
              <SlotsSkeleton />
            </div>
          </div>
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}
