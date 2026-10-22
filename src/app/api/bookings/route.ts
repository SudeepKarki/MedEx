import { z } from "zod";
import { newBookingId, readJson, respond } from "@/server/booking/http";
import { createBooking, takeBySomeoneElse } from "@/server/booking/logic";
import { getBookingDb } from "@/server/booking/store";
import { holdUntilClientGivesUp, mockDelay, readMockControls } from "@/server/mock/with-mock-controls";

const bodySchema = z.object({
  providerId: z.number(),
  specialistId: z.string(),
  date: z.string(),
  startTime: z.string(),
  numberOfPeople: z.number().int(),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

/**
 * POST /bookings { providerId, specialistId, date, startTime, numberOfPeople }
 *   → 201 { bookingId } | 409 { message }
 *
 * Mock API panel scenarios behave like the real thing:
 * - 409: someone else's booking lands first, so the slot really is taken
 *   (a refetch shows it as booked);
 * - 500: fails before doing anything;
 * - "lost-response": the booking IS made, but the reply never arrives. The
 *   optional idempotencyKey lets the browser ask again and get that booking.
 */
export async function POST(request: Request) {
  const { failure } = readMockControls(request);
  if (failure === "timeout") {
    await holdUntilClientGivesUp(request);
    return Response.json({ message: "Simulated timeout" }, { status: 504 });
  }
  await mockDelay(request);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ code: "BAD_REQUEST", message: "Invalid booking." }, { status: 400 });
  if (failure === "500") {
    return Response.json({ code: "SERVER_ERROR", message: "Something went wrong on our side." }, { status: 500 });
  }

  const db = await getBookingDb();
  const body = parsed.data;
  if (failure === "409" && !(body.idempotencyKey && db.replies.has(body.idempotencyKey))) {
    takeBySomeoneElse(db, body.providerId, body.date, body.specialistId, body.startTime);
  }
  const result = createBooking(db, body, { now: Date.now(), newId: () => newBookingId(body.date) });
  if (failure === "lost-response") {
    await holdUntilClientGivesUp(request);
    return Response.json({ message: "Simulated lost response" }, { status: 504 });
  }
  return respond(result);
}
