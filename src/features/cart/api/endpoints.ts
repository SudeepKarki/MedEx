import type { MockEndpointDefinition } from "@/lib/mock-controls/protocol";

export const CART_ENDPOINTS = {
  getCart: { id: "cart.get", label: "GET /api/cart", failureKinds: [500, "network", "timeout"] },
  quantity: {
    id: "cart.quantity",
    label: "PATCH /api/cart/items/:id (quantity)",
    failureKinds: [409, 500, "network", "timeout"],
  },
  duration: {
    id: "cart.duration",
    label: "PATCH /api/cart/items/:id (duration)",
    failureKinds: [409, 500, "network"],
  },
  remove: {
    id: "cart.remove",
    label: "DELETE /api/cart/items/:id",
    failureKinds: [500, "network"],
  },
  merge: {
    id: "cart.merge",
    label: "POST /api/cart/merge",
    failureKinds: [500, "lost-response", "network", "timeout"],
  },
  checkout: {
    id: "checkout",
    label: "POST /api/checkout",
    failureKinds: [402, "declined-later", "lost-response", 409, 500, "network"],
  },
  order: { id: "orders.get", label: "GET /api/orders/:id", failureKinds: [500, "network"] },
  add: { id: "cart.add", label: "POST /api/cart/items", failureKinds: [409, 500] },
  catalog: { id: "catalog", label: "GET /api/catalog", failureKinds: [500, "network"] },
} as const satisfies Record<string, MockEndpointDefinition>;

export const CART_ENDPOINT_LIST: readonly MockEndpointDefinition[] = Object.values(CART_ENDPOINTS);
