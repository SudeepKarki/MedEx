import { describeApiError, isApiError } from "@/lib/api/errors";
import { errorBodySchema } from "../api/schemas";

/** Codes whose server message is written for customers and can be shown as-is. */
const CUSTOMER_FACING = new Set([
  "QUANTITY_LIMIT",
  "UNAVAILABLE",
  "INVALID_OPTION",
  "LINE_NOT_FOUND",
  "PAYMENT_DECLINED",
  "CART_CHANGED",
]);

export function errorBody(error: unknown) {
  if (!isApiError(error)) return null;
  const parsed = errorBodySchema.safeParse(error.body);
  return parsed.success ? parsed.data : null;
}

/** One sentence explaining why a cart change didn't save. */
export function describeCartError(error: unknown, fallback: string): string {
  const body = errorBody(error);
  if (body?.code && CUSTOMER_FACING.has(body.code) && body.message) return body.message;
  if (isApiError(error)) {
    if (error.kind === "http" && error.status === 409) {
      return "That change isn't possible right now: something about this item changed.";
    }
    if (error.kind === "http" && (error.status ?? 0) >= 500) return fallback;
    return describeApiError(error).title + ".";
  }
  return fallback;
}

/** Was this a definitive answer from the server, or could the request have gone either way? */
export function isDefinitive(error: unknown): boolean {
  return isApiError(error) && error.kind === "http" && (error.status ?? 0) < 500;
}
