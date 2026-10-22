"use client";

import { MergeIcon, XIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { MergeChange } from "../api/schemas";
import { mergeHeadline, summarizeMerge } from "../domain/merge-copy";

/** Shown once after sign-in: exactly what happened to the device's cart. */
export function MergeSummary({
  changes,
  onDismiss,
}: {
  changes: MergeChange[];
  onDismiss: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <section
      aria-labelledby="merge-heading"
      className="flex gap-3 rounded-xl border border-primary/30 bg-accent/60 p-4 sm:p-5"
    >
      <MergeIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="flex flex-1 flex-col gap-2">
        <h2
          id="merge-heading"
          ref={headingRef}
          tabIndex={-1}
          className="font-semibold outline-none"
        >
          {mergeHeadline(changes)}
        </h2>
        {changes.length > 0 && (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            {summarizeMerge(changes).map((sentence, i) => (
              <li key={i}>{sentence}</li>
            ))}
          </ul>
        )}
      </div>
      <Button variant="ghost" size="icon" aria-label="Dismiss" onClick={onDismiss}>
        <XIcon aria-hidden />
      </Button>
    </section>
  );
}
