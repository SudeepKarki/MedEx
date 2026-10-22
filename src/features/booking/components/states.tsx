"use client";

import { RefreshCwIcon, ServerCrashIcon, WifiOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { describeApiError, isApiError } from "@/lib/api/errors";

/** A failed section with its own Retry: the rest of the page (and every choice made) stays as it is. */
export function InlineError({
  error,
  onRetry,
  retrying,
  what,
}: {
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
  what: string;
}) {
  const { title, detail } = describeApiError(error);
  const offline = isApiError(error) && error.kind === "offline";
  const Icon = offline ? WifiOffIcon : ServerCrashIcon;
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-card p-5">
      <div className="flex gap-3">
        <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">
            {title}: we couldn&apos;t load {what}
          </p>
          <p className="text-sm text-muted-foreground">{detail} Your choices so far are kept.</p>
        </div>
      </div>
      <Button type="button" variant="outline" onClick={onRetry} disabled={retrying}>
        <RefreshCwIcon aria-hidden className={retrying ? "animate-spin motion-reduce:animate-none" : undefined} />
        {retrying ? "Trying again…" : "Try again"}
      </Button>
    </div>
  );
}
