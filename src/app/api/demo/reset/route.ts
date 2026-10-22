import { resetBookingDb } from "@/server/booking/store";

/** Demo only: restores the fixture (bookings, taken slots) with dates from today. */
export async function POST() {
  await resetBookingDb();
  return new Response(null, { status: 204 });
}
