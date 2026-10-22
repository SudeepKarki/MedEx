"use client";

import { WifiOffIcon } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";

/** Site-wide notice, rendered inside the sticky header so it stays in view. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-warning-muted px-4 py-2 text-center text-sm font-medium text-warning-foreground"
    >
      <WifiOffIcon aria-hidden className="size-4" />
      You&apos;re offline. You can keep browsing what&apos;s already loaded; we&apos;ll reconnect
      automatically.
    </div>
  );
}
