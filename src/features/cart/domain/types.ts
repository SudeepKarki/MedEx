import type { CurrencyCode, Decimal, TotalsByCurrency } from "@/lib/money";

export type PaymentMethod = "card" | "pay_at_clinic";

export interface WellnessOption {
  id: string;
  durationMinutes: number;
  /** Final price per unit for this duration. */
  price: Decimal;
}

export interface CartProduct {
  id: string;
  title: string;
  type: string;
  currency: CurrencyCode;
  providerId: number;
  providerName: string;
  /** Final price per unit; null for wellness (it depends on the duration). */
  price: Decimal | null;
  wellnessOptions: WellnessOption[];
}

export interface CartLine {
  id: string;
  productId: string;
  quantity: number;
  wellnessPricingId: string | null;
  /** null: the provider has removed the service. */
  product: CartProduct | null;
}

export interface Cart {
  /** Server revision; a response older than what we have is ignored. */
  revision: number;
  /** Server group order, one entry per product type ("unknown" for removed products). */
  groupTypes: string[];
  lines: CartLine[];
}

/** A line as the customer sees it right now, including edits still being saved. */
export interface LineView extends CartLine {
  /** Unit price for the chosen option; null when unknown (never 0). */
  unitPrice: Decimal | null;
  lineTotal: Decimal | null;
  chosenOption: WellnessOption | null;
  saving: boolean;
  error: string | null;
  /** Highest quantity the server has told us it accepts for this line. */
  maxQuantity: number | null;
}

export type BlockReason =
  | { kind: "needs-duration"; lineId: string; title: string }
  | { kind: "unavailable" }
  | { kind: "saving" }
  | { kind: "in-checkout" }
  /** Another order is still being checked out; one checkout at a time. */
  | { kind: "other-checkout" }
  /** Not wellness, yet the provider gave no price. */
  | { kind: "no-price"; lineId: string; title: string }
  | { kind: "offline" };

export interface GroupView {
  type: string;
  title: string;
  lines: LineView[];
  itemCount: number;
  /** Quantity of items whose price isn't known yet (wellness without a duration). */
  unpricedCount: number;
  subtotals: TotalsByCurrency;
  /** True for the group of removed services: shown, never checked out. */
  unavailable: boolean;
  blockedBy: BlockReason[];
}
