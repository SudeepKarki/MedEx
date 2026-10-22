import { ApiError } from "@/lib/api/errors";
import { apiRequest } from "@/lib/api/http-client";
import type { z } from "zod";
import { normalizeCart, toProduct } from "../domain/normalize";
import type { Cart, CartProduct, PaymentMethod } from "../domain/types";
import { CART_ENDPOINTS as E } from "./endpoints";
import {
  cartEnvelopeSchema,
  catalogSchema,
  guestCartSchema,
  mergeResponseSchema,
  orderSchema,
  type GuestItem,
  type MergeChange,
  type OrderResponse,
} from "./schemas";

function parse<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiError("Unexpected response shape", "invalid-response");
  return result.data;
}

export async function fetchCart(signal?: AbortSignal): Promise<Cart> {
  const body = await apiRequest({ endpoint: E.getCart.id, path: "/api/cart", signal });
  return normalizeCart(parse(cartEnvelopeSchema, body).cart);
}

export async function patchQuantity(lineId: string, quantity: number): Promise<Cart> {
  const body = await apiRequest({
    endpoint: E.quantity.id,
    path: `/api/cart/items/${encodeURIComponent(lineId)}`,
    method: "PATCH",
    body: { quantity },
  });
  return normalizeCart(parse(cartEnvelopeSchema, body).cart);
}

export async function patchDuration(lineId: string, wellnessPricingId: string): Promise<Cart> {
  const body = await apiRequest({
    endpoint: E.duration.id,
    path: `/api/cart/items/${encodeURIComponent(lineId)}`,
    method: "PATCH",
    body: { wellnessPricingId },
  });
  return normalizeCart(parse(cartEnvelopeSchema, body).cart);
}

export async function deleteLine(lineId: string): Promise<void> {
  await apiRequest({
    endpoint: E.remove.id,
    path: `/api/cart/items/${encodeURIComponent(lineId)}`,
    method: "DELETE",
  });
}

export async function addProduct(productId: string): Promise<Cart> {
  const body = await apiRequest({
    endpoint: E.add.id,
    path: "/api/cart/items",
    method: "POST",
    body: { productId },
  });
  return normalizeCart(parse(cartEnvelopeSchema, body).cart);
}

export async function mergeGuestCart(
  items: GuestItem[],
): Promise<{ cart: Cart; changes: MergeChange[] }> {
  const body = await apiRequest({
    endpoint: E.merge.id,
    path: "/api/cart/merge",
    method: "POST",
    body: { items },
  });
  const parsed = parse(mergeResponseSchema, body);
  return { cart: normalizeCart(parsed.cart), changes: parsed.changes };
}

export interface CheckoutPayload {
  groupType: string;
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
  items: {
    lineId: string;
    productId: string;
    quantity: number;
    wellnessPricingId: string | null;
  }[];
}

export async function placeOrder(payload: CheckoutPayload): Promise<OrderResponse> {
  const body = await apiRequest({
    endpoint: E.checkout.id,
    path: "/api/checkout",
    method: "POST",
    body: payload,
    // Shorter than the server's "lost response" hold, so that case shows up
    // as a timeout (unknown outcome) the way a dropped connection would.
    timeoutMs: 12_000,
  });
  return parse(orderSchema, body);
}

export async function fetchOrder(orderId: string): Promise<OrderResponse> {
  const body = await apiRequest({
    endpoint: E.order.id,
    path: `/api/orders/${encodeURIComponent(orderId)}`,
  });
  return parse(orderSchema, body);
}

export async function fetchCatalog(signal?: AbortSignal): Promise<CartProduct[]> {
  const body = await apiRequest({ endpoint: E.catalog.id, path: "/api/catalog", signal });
  return parse(catalogSchema, body)
    .data.map(toProduct)
    .filter((p): p is CartProduct => p !== null);
}

/** Demo: what this "device" had in its cart before signing in. */
export async function fetchGuestSeed(): Promise<GuestItem[]> {
  const response = await fetch("/api/demo/guest-cart");
  return parse(guestCartSchema, await response.json()).items;
}

export async function resetDemo(): Promise<void> {
  await fetch("/api/demo/reset", { method: "POST" });
}
