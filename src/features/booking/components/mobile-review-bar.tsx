"use client";

import { ArrowDownIcon } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { formatClock, formatPlainDate, parseClock, type PlainDate } from "../domain/plain-date";
import { formatCustomerTime } from "../domain/two-clocks";
import type { Clocks } from "../hooks/use-clocks";

/**
 * Phones only: once a time is chosen, keep it (in both clocks) and the way to
 * confirm in view while the customer is still scrolled up in the grid. Hidden
 * while the summary itself is on screen.
 */
export function MobileReviewBar({
  date,
  startTime,
  clocks,
  summaryRef,
  submitRef,
}: {
  date: PlainDate;
  startTime: string;
  clocks: Clocks;
  summaryRef: RefObject<HTMLElement | null>;
  submitRef: RefObject<HTMLButtonElement | null>;
}) {
  const [summaryVisible, setSummaryVisible] = useState(false);
  useEffect(() => {
    const target = summaryRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setSummaryVisible(Boolean(entry?.isIntersecting)), {
      threshold: 0.4,
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [summaryRef]);

  if (summaryVisible) return null;
  const minutes = parseClock(startTime) ?? 0;
  const time = clocks.dual(date, minutes);

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-backdrop-filter:bg-background/85 lg:hidden">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {formatPlainDate(date)} · {formatClock(minutes)}{" "}
            <span className="text-sm font-normal text-muted-foreground">{clocks.providerCity}</span>
          </p>
          {!clocks.same && (
            <p className="truncate text-xs text-muted-foreground">{formatCustomerTime(time)} your time</p>
          )}
        </div>
        <Button
          type="button"
          onClick={() => {
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            summaryRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
            submitRef.current?.focus({ preventScroll: true });
          }}
        >
          Review
          <ArrowDownIcon aria-hidden />
        </Button>
      </div>
    </div>
  );
}
