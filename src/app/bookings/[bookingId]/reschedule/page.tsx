import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingPageSkeleton } from "@/features/booking/components/page-skeleton";
import { RescheduleRoute } from "@/features/booking/components/routes";

export const metadata: Metadata = { title: "Move your appointment" };

export default function Page() {
  return (
    <Suspense fallback={<BookingPageSkeleton />}>
      <RescheduleRoute />
    </Suspense>
  );
}
