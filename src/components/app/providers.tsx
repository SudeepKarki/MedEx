"use client";

import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isApiError } from "@/lib/api/errors";
import { useMockControls } from "@/lib/mock-controls/store";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        // One automatic retry for transient failures (network, timeout, 5xx).
        // 4xx answers are definitive, so they surface immediately.
        retry: (failureCount, error) =>
          failureCount < 1 && (!isApiError(error) || error.isTransient),
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
    },
  });
}

/** Keeps TanStack's notion of "online" in sync with the browser and the dev panel. */
function useOnlineManagerSync() {
  useEffect(() => {
    onlineManager.setEventListener((setOnline) => {
      const update = () =>
        setOnline(navigator.onLine && !useMockControls.getState().simulateOffline);
      update();
      window.addEventListener("online", update);
      window.addEventListener("offline", update);
      const unsubscribe = useMockControls.subscribe(update);
      return () => {
        window.removeEventListener("online", update);
        window.removeEventListener("offline", update);
        unsubscribe();
      };
    });
  }, []);
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  useOnlineManagerSync();

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster position="bottom-center" />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
