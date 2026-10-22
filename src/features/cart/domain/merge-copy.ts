import type { MergeChange } from "../api/schemas";

/** Plain-language sentences for what a cart merge did, one per change. */
export function describeMergeChange(change: MergeChange): string {
  switch (change.kind) {
    case "added":
      return `${change.title}${change.quantity > 1 ? ` (×${change.quantity})` : ""}${
        change.durationMinutes ? `, ${change.durationMinutes} min,` : ""
      } was added from this device.`;
    case "quantity_raised":
      return `${change.title}: your account had ${change.from} and this device had more, so we kept ${change.to}. We don't add the two together, so nothing is booked twice.`;
    case "already_in_cart":
      return change.deviceQuantity < change.quantity
        ? `${change.title} was already in your cart (${change.quantity}). We kept that rather than adding the ${change.deviceQuantity} from this device.`
        : `${change.title} was already in your cart, so it wasn't added again.`;
    case "duration_applied":
      return `${change.title}: we used the ${change.durationMinutes}-minute option you picked on this device.`;
    case "duration_kept":
      return `${change.title}: your account already had ${change.keptMinutes} minutes chosen, so we kept that. You'd picked ${change.deviceMinutes} minutes on this device; you can change it below.`;
    case "quantity_limited":
      return `${change.title}: you wanted ${change.requested}, but at most ${change.to} can be booked in one order.`;
    case "not_available":
      return `${change.quantity === 1 ? "1 item" : `${change.quantity} items`} from this device ${change.quantity === 1 ? "is" : "are"} no longer available, so ${change.quantity === 1 ? "it wasn't" : "they weren't"} added.`;
  }
}

export function mergeHeadline(changes: readonly MergeChange[]): string {
  const added = changes.filter((c) => c.kind === "added").length;
  if (changes.length === 0) return "You're signed in. Your cart is unchanged.";
  return added > 0
    ? `We added ${added} ${added === 1 ? "item" : "items"} from this device to your account's cart`
    : "We combined this device's cart with your account's cart";
}

/**
 * The sentences to show, one product per line where possible: "already in
 * your cart" is dropped when something more useful happened to the same
 * product (its duration was filled in, its quantity raised…).
 */
export function summarizeMerge(changes: readonly MergeChange[]): string[] {
  const informative = new Set(
    changes.filter((c) => c.kind !== "already_in_cart").map((c) => c.productId),
  );
  return changes
    .filter((c) => !(c.kind === "already_in_cart" && informative.has(c.productId)))
    .map(describeMergeChange);
}
