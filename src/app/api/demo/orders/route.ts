import { getDb } from "@/server/cart/store";
import { orderView } from "@/server/cart/checkout";

/** Demo/testing only: every order the server has accepted (to prove there are no duplicates). */
export async function GET() {
  const db = await getDb();
  return Response.json({
    orders: [...db.orders.values()].map((o) => ({
      ...orderView(o),
      idempotencyKey: o.idempotencyKey,
    })),
  });
}
