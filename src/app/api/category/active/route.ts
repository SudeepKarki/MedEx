import { listActiveCategories } from "@/server/service-explorer/repository";
import { withMockControls } from "@/server/mock/with-mock-controls";

/** Mirrors GET /category/active: top-level categories with their children. */
export async function GET(request: Request) {
  return withMockControls(request, async () =>
    Response.json({ data: await listActiveCategories() }),
  );
}
