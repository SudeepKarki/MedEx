"use client";

import { RefreshCwIcon, ServerCrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { describeApiError } from "@/lib/api/errors";

export function ErrorState({
  error,
  onRetry,
  retrying,
}: {
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
}) {
  const { title, detail } = describeApiError(error);
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 rounded-xl border border-dashed bg-card px-6 py-12 text-center"
    >
      <ServerCrashIcon aria-hidden className="size-10 text-muted-foreground" />
      <div className="flex max-w-md flex-col gap-1">
        <h2 className="font-heading text-xl font-semibold">{title}</h2>
        <p className="text-muted-foreground">{detail} Your cart is safe.</p>
      </div>
      <Button onClick={onRetry} disabled={retrying} size="lg">
        <RefreshCwIcon aria-hidden className={retrying ? "animate-spin" : undefined} />
        {retrying ? "Trying again…" : "Try again"}
      </Button>
    </div>
  );
}
