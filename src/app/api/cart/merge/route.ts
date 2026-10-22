import { z } from "zod";
import { withMockControls } from "@/server/mock/with-mock-controls";
import { badRequest, newLineId, readJson } from "@/server/cart/http";
import { mergeGuestCart } from "@/server/cart/merge";
import { getDb } from "@/server/cart/store";
import { cartView } from "@/server/cart/view";

const bodySchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().min(1),
      wellnessPricingId: z.string().nullish(),
    }),
  ),
});

/** POST /cart/merge { items: guestCart } → 200 { cart, changes } */
export async function POST(request: Request) {
  return withMockControls(request, async () => {
    const body = bodySchema.safeParse(await readJson(request));
    if (!body.success) return badRequest("Expected { items: [{ productId, quantity }] }.");
    const db = await getDb();
    const { lines, changes } = mergeGuestCart(
      db.lines,
      body.data.items.map((i) => ({ ...i, wellnessPricingId: i.wellnessPricingId ?? undefined })),
      db.catalog,
      newLineId,
    );
    db.lines = lines;
    db.revision += 1;
    return Response.json({ cart: cartView(db), changes });
  });
}
