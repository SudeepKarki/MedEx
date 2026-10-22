import { z } from "zod";

/**
 * The cart API's shapes, validated leniently at the boundary. A product is
 * either a full product or `{}` (the provider removed the service).
 */
const wellnessOptionSchema = z.object({
  id: z.string(),
  durationInMinutes: z.number(),
  amount_after_service_charge: z.number(),
});

export const productSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(),
  currency: z.string(),
  providerId: z.number(),
  providerName: z.string(),
  price: z.number().nullable(),
  priceUnknown: z.boolean().optional(),
  wellnessPricing: z.array(wellnessOptionSchema).optional(),
});

export const rawLineSchema = z.object({
  id: z.string(),
  productId: z.string(),
  quantity: z.number().int(),
  wellnessPricingId: z.string().nullish(),
  // `{}` or anything unreadable → treated as "no longer available"
  product: z.unknown(),
});

export const rawCartSchema = z.object({
  groups: z.array(
    z.object({
      type: z.string(),
      itemCount: z.number().optional(),
      unpricedItems: z.number().optional(),
      subtotals: z.record(z.string(), z.number()).optional(),
      items: z.array(rawLineSchema),
    }),
  ),
  totalItems: z.number().optional(),
  revision: z.number().int().default(0),
});

export const cartEnvelopeSchema = z.object({ cart: rawCartSchema });

export const mergeChangeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("added"),
    productId: z.string(),
    title: z.string(),
    quantity: z.number(),
    durationMinutes: z.number().nullable(),
  }),
  z.object({
    kind: z.literal("quantity_raised"),
    productId: z.string(),
    title: z.string(),
    from: z.number(),
    to: z.number(),
  }),
  z.object({
    kind: z.literal("already_in_cart"),
    productId: z.string(),
    title: z.string(),
    quantity: z.number(),
    deviceQuantity: z.number(),
  }),
  z.object({
    kind: z.literal("duration_applied"),
    productId: z.string(),
    title: z.string(),
    durationMinutes: z.number(),
  }),
  z.object({
    kind: z.literal("duration_kept"),
    productId: z.string(),
    title: z.string(),
    keptMinutes: z.number(),
    deviceMinutes: z.number(),
  }),
  z.object({
    kind: z.literal("quantity_limited"),
    productId: z.string(),
    title: z.string(),
    requested: z.number(),
    to: z.number(),
  }),
  z.object({ kind: z.literal("not_available"), productId: z.string(), quantity: z.number() }),
]);

export const mergeResponseSchema = z.object({
  cart: rawCartSchema,
  changes: z.array(mergeChangeSchema),
});

export const orderSchema = z.object({
  orderId: z.string(),
  status: z.enum(["pending", "paid", "failed"]),
  paymentMethod: z.enum(["card", "pay_at_clinic"]).optional(),
  totals: z.record(z.string(), z.number()).optional(),
});

export const errorBodySchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
  maxQuantity: z.number().optional(),
});

export const catalogSchema = z.object({ data: z.array(productSchema) });

export const guestCartSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().min(1),
      wellnessPricingId: z.string().optional(),
    }),
  ),
});

export type RawCart = z.infer<typeof rawCartSchema>;
export type RawProduct = z.infer<typeof productSchema>;
export type MergeChange = z.infer<typeof mergeChangeSchema>;
export type GuestItem = z.infer<typeof guestCartSchema>["items"][number];
export type OrderResponse = z.infer<typeof orderSchema>;
