import { getBookingDb } from "@/server/booking/store";
import { withMockControls } from "@/server/mock/with-mock-controls";

/**
 * GET /booking/providers: the bookable providers (not in the brief; lets the
 * demo pick one). Not /providers, which is the service explorer's list.
 */
export async function GET(request: Request) {
  return withMockControls(request, async () => {
    const db = await getBookingDb();
    return Response.json({ data: [...db.rawProviders.values()] });
  });
}
