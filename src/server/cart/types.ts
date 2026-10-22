/** Shapes of the cart fixture and of the mock server's own state. */

export interface WellnessOption {
  id: string;
  durationInMinutes: number;
  amount_after_service_charge: number;
}

/** A product as the catalog and GET /v2/cart describe it. Prices are final, per unit. */
export interface CatalogProduct {
  id: string;
  title: string;
  type: string;
  currency: string;
  providerId: number;
  providerName: string;
  price: number | null;
  priceUnknown?: boolean;
  wellnessPricing?: WellnessOption[];
}

export interface GuestCartItem {
  productId: string;
  quantity: number;
  wellnessPricingId?: string;
}

export interface CartFixture {
  catalog: CatalogProduct[];
  serverCart: {
    groups: { type: string; items: { id: string; productId: string; quantity: number }[] }[];
  };
  guestCart: GuestCartItem[];
}

export interface ServerLine {
  id: string;
  productId: string;
  quantity: number;
  /** Chosen duration for wellness services; null until the customer picks one. */
  wellnessPricingId: string | null;
}

export type PaymentMethod = "card" | "pay_at_clinic";
export type OrderStatus = "pending" | "paid" | "failed";

export interface OrderItem {
  lineId: string;
  productId: string;
  title: string;
  providerName: string;
  quantity: number;
  wellnessPricingId: string | null;
  durationMinutes: number | null;
  currency: string;
  /** Final price per unit, in minor units. */
  unitMinor: number;
}

export interface ServerOrder {
  orderId: string;
  idempotencyKey: string;
  groupType: string;
  paymentMethod: PaymentMethod;
  items: OrderItem[];
  /** Per currency, minor units. Never summed across currencies. */
  totalsMinor: Record<string, number>;
  createdAt: number;
  status: OrderStatus;
  /** Card payments settle asynchronously: when, and how. */
  settleAt: number | null;
  outcome: "paid" | "failed" | null;
  /** Lines of a failed payment go back into the cart, once. */
  restored: boolean;
}

/** What an idempotency key resolves to: the exact response it produced. */
export interface IdempotencyRecord {
  fingerprint: string;
  status: number;
  body: unknown;
}
