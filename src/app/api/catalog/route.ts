import { withMockControls } from "@/server/mock/with-mock-controls";
import { getDb } from "@/server/cart/store";

/** GET /catalog → { data: products }. Resolves the guest cart's product ids. */
export async function GET(request: Request) {
  return withMockControls(request, async () =>
    Response.json({ data: [...(await getDb()).catalog.values()] }),
  );
}
