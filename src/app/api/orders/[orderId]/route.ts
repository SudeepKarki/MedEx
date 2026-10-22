import { withMockControls } from "@/server/mock/with-mock-controls";
import { respond } from "@/server/cart/http";
import { readOrder } from "@/server/cart/checkout";
import { getDb } from "@/server/cart/store";

/** GET /orders/:orderId → { orderId, status: "pending" | "paid" | "failed", … } */
export async function GET(request: Request, context: RouteContext<"/api/orders/[orderId]">) {
  const { orderId } = await context.params;
  return withMockControls(request, async () =>
    respond(readOrder(await getDb(), orderId, Date.now())),
  );
}
