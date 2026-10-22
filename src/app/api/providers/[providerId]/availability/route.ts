import { MAX_PEOPLE } from "@/features/booking/domain/types";
import { notFound } from "@/server/booking/http";
import { availabilityFor } from "@/server/booking/logic";
import { getBookingDb } from "@/server/booking/store";
import { withMockControls } from "@/server/mock/with-mock-controls";

/**
 * GET /providers/:id/availability?specialistId=&people=&exceptBooking=
 *   → { days: [{ date, status }] } for the 90-day window.
 *
 * Not in the brief: without it the calendar would need 90 slot requests to
 * know which days to grey out (and why).
 */
export async function GET(request: Request, context: RouteContext<"/api/providers/[providerId]/availability">) {
  const { providerId } = await context.params;
  return withMockControls(request, async () => {
    const url = new URL(request.url);
    const db = await getBookingDb();
    const provider = db.providers.get(Number(providerId));
    if (!provider) return notFound();
    const specialistParam = url.searchParams.get("specialistId");
    if (specialistParam && !provider.specialists.some((s) => s.id === specialistParam)) {
      return Response.json({ code: "BAD_REQUEST", message: "Unknown specialist." }, { status: 400 });
    }
    const people = Math.min(MAX_PEOPLE, Math.max(1, Number(url.searchParams.get("people")) || 1));
    const now = Date.now();
    return Response.json({
      days: availabilityFor(
        db,
        provider,
        url.searchParams.get("specialistId"),
        people,
        now,
        url.searchParams.get("exceptBooking") ?? undefined,
      ),
      now: new Date(now).toISOString(),
    });
  });
}
