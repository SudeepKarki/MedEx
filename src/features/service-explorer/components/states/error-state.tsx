"use client";

import { RefreshCwIcon, ServerCrashIcon, WifiOffIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { describeApiError, isApiError } from "@/lib/api/errors";

export function ErrorState({
  error,
  failedSources,
  onRetry,
  retrying,
}: {
  error: unknown;
  failedSources: string[];
  onRetry: () => void;
  retrying: boolean;
}) {
  const { title, detail } = describeApiError(error);
  const offline = isApiError(error) && error.kind === "offline";
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const Icon = offline ? WifiOffIcon : ServerCrashIcon;

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 rounded-xl border border-dashed bg-card px-6 py-12 text-center"
    >
      <Icon aria-hidden className="size-10 text-muted-foreground" />
      <div className="flex max-w-md flex-col gap-2">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-heading text-xl font-semibold outline-none"
        >
          {title}
        </h2>
        <p className="text-muted-foreground">{detail}</p>
        {failedSources.length > 0 && failedSources.length < 3 && (
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t load the {failedSources.join(" and ")}. Everything else is ready, so
            only that will be fetched again.
          </p>
        )}
      </div>
      <Button onClick={onRetry} disabled={retrying} size="lg">
        <RefreshCwIcon aria-hidden className={retrying ? "animate-spin" : undefined} />
        {retrying ? "Trying again…" : "Try again"}
      </Button>
    </div>
  );
}

export function OfflineWaitingState() {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-12 text-center"
    >
      <WifiOffIcon aria-hidden className="size-10 text-muted-foreground" />
      <h2 className="font-heading text-xl font-semibold">You&apos;re offline</h2>
      <p className="max-w-md text-muted-foreground">
        We&apos;ll load services as soon as your connection is back. There&apos;s no need to reload
        the page.
      </p>
    </div>
  );
}
