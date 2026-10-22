import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingDetailsRoute, BookingDetailsSkeleton } from "@/features/booking/components/booking-details";

export const metadata: Metadata = { title: "Your appointment" };

export default function Page() {
  return (
    <Suspense fallback={<BookingDetailsSkeleton />}>
      <BookingDetailsRoute />
    </Suspense>
  );
}
