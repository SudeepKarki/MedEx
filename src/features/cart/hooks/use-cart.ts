"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { fetchCart } from "../api/client";
import { buildGroups } from "../domain/view";
import { useCartEdits } from "../state/cart-edits";
import { useCartSession } from "../state/cart-session";
import { lockedGroupTypes, useCheckoutSession } from "../state/checkout-session";
import { CART_KEY } from "../state/line-sync";

/** The signed-in customer's cart as it should look right now (server state + pending edits). */
export function useCart() {
  const signedIn = useCartSession((s) => s.signedIn);
  const query = useQuery({
    queryKey: CART_KEY,
    queryFn: ({ signal }) => fetchCart(signal),
    enabled: signedIn,
    staleTime: 30_000,
  });
  const edits = useCartEdits((s) => s.edits);
  const saving = useCartEdits((s) => s.saving);
  const errors = useCartEdits((s) => s.errors);
  const maxQuantities = useCartEdits((s) => s.maxQuantities);
  const session = useCheckoutSession((s) => s.session);
  const online = useOnlineStatus();

  const groups = useMemo(
    () =>
      query.data
        ? buildGroups(query.data, {
            edits,
            savingLines: new Set(Object.keys(saving)),
            errors,
            maxQuantities,
            checkingOut: lockedGroupTypes(session),
            online,
          })
        : null,
    [query.data, edits, saving, errors, maxQuantities, session, online],
  );

  return { query, groups };
}
