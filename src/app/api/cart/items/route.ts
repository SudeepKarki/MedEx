import { z } from "zod";
import { withMockControls } from "@/server/mock/with-mock-controls";
import { badRequest, newLineId, readJson, respond } from "@/server/cart/http";
import { addItem } from "@/server/cart/mutations";
import { getDb } from "@/server/cart/store";

const bodySchema = z.object({ productId: z.string().min(1) });

/** POST /cart/items { productId } → 201 { cart } | 409. Not in the brief: lets the demo refill the cart. */
export async function POST(request: Request) {
  return withMockControls(request, async () => {
    const body = bodySchema.safeParse(await readJson(request));
    if (!body.success) return badRequest("Expected { productId }.");
    return respond(addItem(await getDb(), body.data.productId, newLineId));
  });
}
