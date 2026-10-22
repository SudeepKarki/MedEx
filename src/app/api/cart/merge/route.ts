import { z } from "zod";
import {
  holdUntilClientGivesUp,
  mockDelay,
  readMockControls,
  withMockControls,
} from "@/server/mock/with-mock-controls";
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
  /** Same key → the first merge's response again (a retried sign-in mustn't re-merge). */
  idempotencyKey: z.string().min(8).max(200).optional(),
});

/**
 * POST /cart/merge { items: guestCart, idempotencyKey? } → 200 { cart, changes }
 *
 * The merge itself is idempotent (larger quantity wins), but its *report*
 * isn't: a retry would say "already in your cart" about items the first
 * attempt just added. So the first response per key is kept and replayed.
 * "Order placed, reply lost" from the Mock API panel merges, then holds the
 * reply past the browser's timeout.
 */
export async function POST(request: Request) {
  const { failure } = readMockControls(request);
  if (failure !== "lost-response") {
    return withMockControls(request, () => merge(request));
  }
  await mockDelay(request);
  await merge(request);
  await holdUntilClientGivesUp(request);
  return Response.json({ code: "TIMEOUT", message: "Simulated lost response" }, { status: 504 });
}

async function merge(request: Request): Promise<Response> {
  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) return badRequest("Expected { items: [{ productId, quantity }] }.");
  const key = body.data.idempotencyKey;
  const db = await getDb();
  if (key && db.mergeReplays.has(key)) return Response.json(db.mergeReplays.get(key));

  const { lines, changes } = mergeGuestCart(
    db.lines,
    body.data.items.map((i) => ({ ...i, wellnessPricingId: i.wellnessPricingId ?? undefined })),
    db.catalog,
    newLineId,
  );
  db.lines = lines;
  db.revision += 1;
  const response = { cart: cartView(db), changes };
  if (key) db.mergeReplays.set(key, response);
  return Response.json(response);
}
