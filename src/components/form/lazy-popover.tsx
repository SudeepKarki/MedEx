"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * An icon button that opens a popover, where the popover machinery is only
 * mounted the first time it's needed. Result lists render dozens of these
 * ("price breakdown" per row) and most are never opened.
 */
export function LazyPopover({
  label,
  icon,
  children,
  contentClassName,
}: {
  /** Accessible name of the trigger button. */
  label: string;
  icon: ReactNode;
  children: ReactNode;
  contentClassName?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={false}
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        {icon}
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={label}>
          {icon}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className={contentClassName}>
        {children}
      </PopoverContent>
    </Popover>
  );
}
