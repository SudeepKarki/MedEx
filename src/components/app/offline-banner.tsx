"use client";

import { WifiOffIcon } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";

/**
 * Site-wide notice. It reserves no space while online and sits above the page
 * content when it appears, so it never pushes results around.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-warning-muted px-4 py-2 text-sm font-medium text-warning-foreground shadow-sm"
    >
      <WifiOffIcon aria-hidden className="size-4" />
      You&apos;re offline. You can keep browsing what&apos;s already loaded; we&apos;ll reconnect
      automatically.
    </div>
  );
}
