"use client";

import { useEffect, useState } from "react";
import { ResultsHeaderSkeleton, ResultsSkeleton } from "./skeletons";

const SLOW_AFTER_MS = 4000;

/**
 * Skeletons while loading. If it takes unusually long, say so in words (and to
 * screen readers): a skeleton alone can't tell "slow" from "stuck".
 */
export function LoadingState({ loaded, total }: { loaded: number; total: number }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <ResultsHeaderSkeleton />
      <p role="status" className="min-h-5 text-sm text-muted-foreground">
        {slow ? (
          `Still loading (${loaded} of ${total} parts ready). This is taking longer than usual, so your connection may be slow.`
        ) : (
          <span className="sr-only">Loading services…</span>
        )}
      </p>
      <ResultsSkeleton />
    </div>
  );
}
