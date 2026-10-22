import { isPlainDate } from "@/features/booking/domain/plain-date";
import { notFound } from "@/server/booking/http";
import { slotsFor } from "@/server/booking/logic";
import { getBookingDb } from "@/server/booking/store";
import { withMockControls } from "@/server/mock/with-mock-controls";

/** GET /providers/:id/slots?date=YYYY-MM-DD&specialistId=… → slots for that date, with isBooked */
export async function GET(request: Request, context: RouteContext<"/api/providers/[providerId]/slots">) {
  const { providerId } = await context.params;
  return withMockControls(request, async () => {
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const db = await getBookingDb();
    const provider = db.providers.get(Number(providerId));
    if (!provider) return notFound();
    if (!isPlainDate(date)) {
      return Response.json({ code: "BAD_REQUEST", message: "date must be YYYY-MM-DD" }, { status: 400 });
    }
    const specialistParam = url.searchParams.get("specialistId");
    if (specialistParam && !provider.specialists.some((s) => s.id === specialistParam)) {
      return Response.json({ code: "BAD_REQUEST", message: "Unknown specialist." }, { status: 400 });
    }
    const now = Date.now();
    return Response.json({
      ...slotsFor(db, provider, date, url.searchParams.get("specialistId"), now),
      now: new Date(now).toISOString(),
    });
  });
}
