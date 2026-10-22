"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircleIcon, LogInIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { describeApiError } from "@/lib/api/errors";
import { mergeGuestCart } from "../api/client";
import { useCartSession } from "../state/cart-session";
import { CART_KEY } from "../state/line-sync";

/**
 * Demo sign-in: no credentials, just "become the demo customer". Signing in
 * merges this device's cart into the account (POST /cart/merge). The device
 * cart is only cleared once the merge succeeded, and the merge is safe to
 * retry (the server keeps the larger quantity, so repeating it adds nothing).
 */
export function SignInDialog({ triggerLabel = "Sign in to check out" }: { triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const guestItems = useCartSession((s) => s.guestItems) ?? [];
  const completeSignIn = useCartSession((s) => s.completeSignIn);

  const merge = useMutation({
    mutationFn: () => (guestItems.length ? mergeGuestCart(guestItems) : Promise.resolve(null)),
    retry: false,
    onSuccess: (result) => {
      if (result) queryClient.setQueryData(CART_KEY, result.cart);
      completeSignIn(result?.changes ?? []);
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !merge.isPending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button size="lg">
          <LogInIcon aria-hidden />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign in</DialogTitle>
          <DialogDescription>
            This is a demo, so there&apos;s no password. You&apos;ll sign in as our demo customer,
            Asha, who already has a few services in her cart.
          </DialogDescription>
        </DialogHeader>
        {guestItems.length > 0 && (
          <p className="text-sm">
            We&apos;ll add the {guestItems.length} {guestItems.length === 1 ? "item" : "items"} in
            this device&apos;s cart to Asha&apos;s cart and show you exactly what changed.
          </p>
        )}
        {merge.isError && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              {describeApiError(merge.error).title}. You&apos;re still signed out and your cart on
              this device is unchanged. It&apos;s safe to try again.
            </span>
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={merge.isPending}>
            Cancel
          </Button>
          <Button onClick={() => merge.mutate()} disabled={merge.isPending}>
            {merge.isPending ? "Signing in…" : merge.isError ? "Try again" : "Continue as Asha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
