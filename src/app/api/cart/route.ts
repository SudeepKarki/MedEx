import { withMockControls } from "@/server/mock/with-mock-controls";
import { getDb } from "@/server/cart/store";
import { cartView } from "@/server/cart/view";

/** GET /cart → 200 { cart } (shape of GET /v2/cart, plus `revision`) */
export async function GET(request: Request) {
  return withMockControls(request, async () => Response.json({ cart: cartView(await getDb()) }));
}
