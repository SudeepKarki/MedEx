import { connection } from "next/server";
import { orderView } from "@/server/cart/checkout";
import { getDb } from "@/server/cart/store";

/** Demo/testing only: every order the server has accepted (to prove there are no duplicates). */
export async function GET() {
  // Live state, never prerendered (a GET that reads nothing would be, under Cache Components)
  await connection();
  const db = await getDb();
  return Response.json({
    orders: [...db.orders.values()].map((o) => ({
      ...orderView(o),
      idempotencyKey: o.idempotencyKey,
    })),
  });
}
