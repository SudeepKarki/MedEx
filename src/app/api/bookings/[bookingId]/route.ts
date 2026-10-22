import { z } from "zod";
import { notFound, readJson, respond } from "@/server/booking/http";
import { moveBooking, takeBySomeoneElse } from "@/server/booking/logic";
import { getBookingDb } from "@/server/booking/store";
import { mockDelay, readMockControls, withMockControls } from "@/server/mock/with-mock-controls";

/** GET /bookings/:id → { booking } (not in the brief; the reschedule flow starts from it) */
export async function GET(request: Request, context: RouteContext<"/api/bookings/[bookingId]">) {
  const { bookingId } = await context.params;
  return withMockControls(request, async () => {
    const booking = (await getBookingDb()).bookings.get(bookingId);
    return booking ? Response.json({ booking }) : notFound();
  });
}

const bodySchema = z.object({ date: z.string(), startTime: z.string() });

/**
 * PUT /bookings/:id { date, startTime } → 200 | 409
 * Moving is idempotent (moving to where it already is succeeds), so it's
 * safe to retry. A 409 from the Mock API panel takes the new slot first.
 */
export async function PUT(request: Request, context: RouteContext<"/api/bookings/[bookingId]">) {
  const { bookingId } = await context.params;
  const { failure } = readMockControls(request);
  if (failure !== "409") return withMockControls(request, () => move(request, bookingId, false));
  await mockDelay(request);
  return move(request, bookingId, true);
}

async function move(request: Request, bookingId: string, takeFirst: boolean) {
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ code: "BAD_REQUEST", message: "Invalid change." }, { status: 400 });
  const db = await getBookingDb();
  const booking = db.bookings.get(bookingId);
  if (takeFirst && booking) {
    takeBySomeoneElse(db, booking.providerId, parsed.data.date, booking.specialistId, parsed.data.startTime);
  }
  return respond(moveBooking(db, bookingId, parsed.data, { now: Date.now() }));
}
