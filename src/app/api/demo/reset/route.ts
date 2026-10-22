import { resetDb } from "@/server/cart/store";

/** Demo only: restores the fixture cart and forgets all orders and keys. */
export async function POST() {
  await resetDb();
  return new Response(null, { status: 204 });
}
