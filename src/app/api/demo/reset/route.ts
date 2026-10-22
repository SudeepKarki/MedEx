import { resetBookingDb } from "@/server/booking/store";
import { resetDb as resetCartDb } from "@/server/cart/store";

/**
 * Demo only. `?scope=cart` restores the fixture cart and forgets all orders and
 * keys; `?scope=booking` restores the bookings and taken slots (dates from
 * today); no scope does both. Each exercise resets only its own data, so its
 * e2e suite can run alongside the others without wiping their state.
 */
export async function POST(request: Request) {
  const scope = new URL(request.url).searchParams.get("scope");
  if (scope !== "booking") await resetCartDb();
  if (scope !== "cart") await resetBookingDb();
  return new Response(null, { status: 204 });
}
