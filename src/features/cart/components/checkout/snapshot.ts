import { decimal, sumByCurrency, type TotalsByCurrency } from "@/lib/money";
import type { GroupView } from "../../domain/types";
import type { GroupDraft, SnapshotItem } from "../../state/checkout-session";
import type { PaymentMethod } from "../../domain/types";

/** Freezes a ready cart group into what will be sent and shown for its order. */
export function draftFromGroup(group: GroupView, paymentMethod: PaymentMethod): GroupDraft {
  const items: SnapshotItem[] = group.lines.map((line) => ({
    lineId: line.id,
    productId: line.productId,
    title: line.product!.title,
    providerName: line.product!.providerName,
    quantity: line.quantity,
    wellnessPricingId: line.wellnessPricingId,
    durationMinutes: line.chosenOption?.durationMinutes ?? null,
    currency: line.product!.currency,
    unitPrice: line.unitPrice!.toString(),
  }));
  return {
    groupType: group.type,
    title: group.title,
    paymentMethod,
    items,
    totals: Object.fromEntries([...group.subtotals].map(([c, a]) => [c, a.toString()])),
  };
}

export function totalsOf(totals: Record<string, string>): TotalsByCurrency {
  return new Map(Object.entries(totals).map(([c, a]) => [c, decimal(a)]));
}

/** For "pay at the clinic": what to pay at each provider. */
export function totalsByProvider(items: readonly SnapshotItem[]) {
  const byProvider = new Map<string, SnapshotItem[]>();
  for (const item of items)
    byProvider.set(item.providerName, [...(byProvider.get(item.providerName) ?? []), item]);
  return [...byProvider].map(([provider, list]) => ({
    provider,
    totals: sumByCurrency(
      list.map((i) => ({ currency: i.currency, amount: decimal(i.unitPrice).times(i.quantity) })),
    ),
  }));
}
