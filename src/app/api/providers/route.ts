import { getBookingDb } from "@/server/booking/store";
import { withMockControls } from "@/server/mock/with-mock-controls";

/** GET /providers: the bookable providers (not in the brief; lets the demo pick one). */
export async function GET(request: Request) {
  return withMockControls(request, async () => {
    const db = await getBookingDb();
    return Response.json({ data: [...db.rawProviders.values()] });
  });
}
