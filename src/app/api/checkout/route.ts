import { badRequest, newOrderId, readJson, respond } from "@/server/cart/http";
import { checkoutRequestSchema, placeOrder, type InjectedOutcome } from "@/server/cart/checkout";
import { getDb } from "@/server/cart/store";
import {
  holdUntilClientGivesUp,
  mockDelay,
  readMockControls,
} from "@/server/mock/with-mock-controls";

const INJECTED: Record<string, InjectedOutcome> = {
  "402": "declined",
  "409": "conflict",
  "500": "server-error",
  "declined-later": "declined-later",
};

/**
 * POST /checkout { groupType, items, paymentMethod, idempotencyKey }
 *   → 201 { orderId, status } | 402 | 409 | 500
 *
 * Failures from the Mock API panel are applied *inside* the idempotent
 * order logic, so they behave like real ones (a decline is remembered for
 * its key; a 500 isn't). "timeout" models the nastiest case: the order IS
 * placed, but the reply never reaches the browser. Retrying with the same
 * key must then return that order, not place a second one.
 */
export async function POST(request: Request) {
  const { failure } = readMockControls(request);
  await mockDelay(request, 200);

  const body = checkoutRequestSchema.safeParse(await readJson(request));
  if (!body.success) return badRequest("Invalid checkout request.");

  const db = await getDb();
  const result = placeOrder(db, body.data, {
    now: Date.now(),
    newOrderId,
    injected: failure ? (INJECTED[failure] ?? null) : null,
  });

  if (failure === "timeout" || failure === "lost-response") {
    await holdUntilClientGivesUp(request);
    return Response.json({ code: "TIMEOUT", message: "Simulated lost response" }, { status: 504 });
  }
  return respond(result);
}
