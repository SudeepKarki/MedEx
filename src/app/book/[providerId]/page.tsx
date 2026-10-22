import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingPageSkeleton } from "@/features/booking/components/page-skeleton";
import { BookRoute } from "@/features/booking/components/routes";

export const metadata: Metadata = { title: "Book an appointment" };

// The provider id and the choices come from the URL at request time, so the
// static shell is the skeleton and the rest renders in the browser.
export default function Page() {
  return (
    <Suspense fallback={<BookingPageSkeleton />}>
      <BookRoute />
    </Suspense>
  );
}
