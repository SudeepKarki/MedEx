"use client";

import { useId, type ReactNode } from "react";
import { NativeCheckbox } from "@/components/form/native-checkbox";
import { formatCount } from "@/lib/money";
import { cn } from "@/lib/utils";

interface FacetOptionProps {
  label: ReactNode;
  /** Results this option leads to, given every other active filter. */
  count: number;
  checked: boolean | "indeterminate";
  onToggle: () => void;
  className?: string;
}

/**
 * One filter option with its live count.
 *
 * Options that would lead to zero results are *disabled, not hidden*:
 * - the list doesn't reflow under the cursor as other filters change (no
 *   layout shift, and no "where did Wellness go?" moment);
 * - customers still learn what exists ("there are wellness treatments, just
 *   not in Pokhara under NPR 2,000");
 * - an option that is already selected stays enabled even at zero, so the
 *   customer can always undo it.
 */
export function FacetOption({ label, count, checked, onToggle, className }: FacetOptionProps) {
  const id = useId();
  const disabled = count === 0 && checked === false;
  return (
    <div
      className={cn(
        "group flex min-h-9 items-center gap-3 rounded-md px-2 transition-colors hover:bg-muted/70 pointer-coarse:min-h-11",
        disabled && "hover:bg-transparent",
        className,
      )}
    >
      <NativeCheckbox
        id={id}
        checked={checked === true}
        indeterminate={checked === "indeterminate"}
        disabled={disabled}
        onChange={onToggle}
      />
      <label
        htmlFor={id}
        className={cn(
          "flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 py-1.5 text-sm",
          disabled && "cursor-not-allowed text-muted-foreground",
        )}
      >
        <span className="min-w-0 truncate">{label}</span>
        <span
          className={cn(
            "min-w-8 text-right text-xs tabular-nums",
            disabled ? "text-muted-foreground/80" : "text-muted-foreground",
          )}
        >
          {formatCount(count)}
          <span className="sr-only"> {count === 1 ? "result" : "results"}</span>
        </span>
      </label>
    </div>
  );
}
