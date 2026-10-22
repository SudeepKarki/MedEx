"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, ShoppingCartIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { addProduct, fetchCatalog } from "../api/client";
import { describeCartError } from "../domain/errors";
import { groupTitle } from "../domain/labels";
import { applyServerCart } from "../state/line-sync";

/** Empty cart: say so, and offer a few services to add (the demo has no catalogue page). */
export function EmptyCart() {
  const queryClient = useQueryClient();
  const catalog = useQuery({
    queryKey: ["catalog"],
    queryFn: ({ signal }) => fetchCatalog(signal),
  });
  const add = useMutation({
    mutationFn: addProduct,
    onSuccess: (cart) => applyServerCart(queryClient, cart),
    onError: (error) => toast.error(describeCartError(error, "We couldn't add that service.")),
  });
  const suggestions = catalog.data
    ?.filter((p) => p.price !== null || p.wellnessOptions.length)
    .slice(0, 6);

  return (
    <div className="flex flex-col items-center gap-6 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <ShoppingCartIcon aria-hidden className="size-10 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-xl font-semibold">Your cart is empty</h2>
        <p className="text-muted-foreground">Add a service to get started.</p>
      </div>
      {suggestions && (
        <ul className="grid w-full max-w-2xl gap-2 text-left sm:grid-cols-2">
          {suggestions.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <span className="flex flex-col">
                <span className="text-sm font-medium">{p.title}</span>
                <span className="text-xs text-muted-foreground">
                  {groupTitle(p.type)} · {p.providerName}
                  {p.price && ` · ${formatMoney(p.price, p.currency)}`}
                </span>
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label={`Add ${p.title}`}
                disabled={add.isPending}
                onClick={() => add.mutate(p.id)}
              >
                <PlusIcon aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
