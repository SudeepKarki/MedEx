import { connection } from "next/server";
import { getDb } from "@/server/cart/store";

/**
 * Demo only: the guest cart from the fixture, which the browser stores as
 * "what this device added before signing in" on first visit.
 */
export async function GET() {
  await connection();
  return Response.json({ items: (await getDb()).guestCart });
}
