"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * A real <input type="checkbox">, themed with `accent-color`.
 *
 * Used where many checkboxes re-render together (filter facets): the native
 * control costs almost nothing to render compared with a scripted one,
 * supports `indeterminate`, works with <label> and forms, and is announced
 * correctly by every screen reader.
 */
export function NativeCheckbox({
  className,
  indeterminate = false,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        "size-4 shrink-0 cursor-pointer rounded-sm accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

/** Native radio button, same reasoning as NativeCheckbox. */
export function NativeRadio({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="radio"
      className={cn(
        "size-4 shrink-0 cursor-pointer accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
