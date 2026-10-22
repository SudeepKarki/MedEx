import { notFound } from "@/server/booking/http";
import { getBookingDb } from "@/server/booking/store";
import { withMockControls } from "@/server/mock/with-mock-controls";

/**
 * GET /providers/:id → the provider, including specialists (production shape,
 * time zone exactly as typed), plus closures as real dates and the server's
 * clock (`now`), which the browser uses instead of trusting the device's.
 */
export async function GET(request: Request, context: RouteContext<"/api/providers/[providerId]">) {
  const { providerId } = await context.params;
  return withMockControls(request, async () => {
    const db = await getBookingDb();
    const provider = db.rawProviders.get(Number(providerId));
    if (!provider) return notFound();
    return Response.json({ provider, now: new Date().toISOString() });
  });
}
