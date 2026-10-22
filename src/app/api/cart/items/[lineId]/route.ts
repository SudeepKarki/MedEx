import { z } from "zod";
import { withMockControls } from "@/server/mock/with-mock-controls";
import { badRequest, readJson, respond } from "@/server/cart/http";
import { chooseDuration, removeLine, updateQuantity } from "@/server/cart/mutations";
import { getDb } from "@/server/cart/store";

const patchSchema = z.union([
  z.object({ quantity: z.number() }),
  z.object({ wellnessPricingId: z.string().min(1) }),
]);

/**
 * PATCH /cart/items/:lineId { quantity } → 200 { cart } | 409 | 500
 * PATCH /cart/items/:lineId { wellnessPricingId } → 200 { cart }
 */
export async function PATCH(request: Request, context: RouteContext<"/api/cart/items/[lineId]">) {
  const { lineId } = await context.params;
  return withMockControls(request, async () => {
    const body = patchSchema.safeParse(await readJson(request));
    if (!body.success) return badRequest("Expected { quantity } or { wellnessPricingId }.");
    const db = await getDb();
    return respond(
      "quantity" in body.data
        ? updateQuantity(db, lineId, body.data.quantity)
        : chooseDuration(db, lineId, body.data.wellnessPricingId),
    );
  });
}

/** DELETE /cart/items/:lineId → 204 */
export async function DELETE(request: Request, context: RouteContext<"/api/cart/items/[lineId]">) {
  const { lineId } = await context.params;
  return withMockControls(request, async () => respond(removeLine(await getDb(), lineId)));
}
