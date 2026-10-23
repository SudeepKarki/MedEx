"use client";

import { WifiOffIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useOnlineStatus } from "@/hooks/use-online-status";

const SLOW_AFTER_MS = 3000;

/**
 * Skeletons while the cart loads. When it takes unusually long, or the device is
 * offline, say so in words (and to screen readers): a skeleton alone can't tell
 * "slow" from "stuck".
 */
export function CartSkeleton() {
  const online = useOnlineStatus();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <p role="status" className="flex min-h-5 items-center gap-1.5 text-sm text-muted-foreground">
        {!online ? (
          <>
            <WifiOffIcon aria-hidden className="size-4 shrink-0" />
            You&apos;re offline. Your cart will load as soon as you&apos;re back online.
          </>
        ) : slow ? (
          "Still loading your cart. This is taking longer than usual, so your connection may be slow."
        ) : (
          <span className="sr-only">Loading your cart…</span>
        )}
      </p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]" aria-hidden>
        <div className="flex flex-col gap-4">
          {[3, 1, 2].map((rows, i) => (
            <div key={i} className="rounded-xl border bg-card">
              <div className="flex justify-between border-b p-5">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-6 w-28" />
              </div>
              <div className="flex flex-col gap-4 p-5">
                {Array.from({ length: rows }, (_, r) => (
                  <div key={r} className="flex justify-between gap-4">
                    <div className="flex flex-1 flex-col gap-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3.5 w-1/3" />
                    </div>
                    <Skeleton className="h-9 w-28" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
