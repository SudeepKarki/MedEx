"use client";

import { Building2Icon, PencilIcon, UserIcon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatClock, formatPlainDate } from "../domain/plain-date";
import { formatOffset, offsetMinutes, toWallClock, type Zone } from "../domain/timezone";
import { clockGap } from "../domain/two-clocks";
import type { Clocks } from "../hooks/use-clocks";
import { TimeZoneSelect } from "./time-zone-select";

/**
 * The answer to "which time is the appointment, mine or theirs?", stated once
 * at the top: two live clocks, labelled by place, and a sentence saying which
 * one every time on the page uses.
 */
export function ClockStrip({ clocks, providerName }: { clocks: Clocks; providerName: string }) {
  const [editing, setEditing] = useState(false);
  const changeRef = useRef<HTMLButtonElement>(null);
  const at = clocks.minute * 60_000;
  const ready = clocks.minute > 0;
  const gap = clockGap(clocks.provider, clocks.customer, at);

  return (
    <section aria-labelledby="clocks-heading" className="flex flex-col gap-3">
      <h2 id="clocks-heading" className="sr-only">
        Time zones
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Clock
          icon={<Building2Icon aria-hidden className="size-5" />}
          label={`Appointment time · ${clocks.providerLabel}`}
          zone={clocks.provider}
          at={at}
          ready={ready}
          tone="provider"
          footnote="Appointment times use this clock."
        />
        <Clock
          icon={<UserIcon aria-hidden className="size-5" />}
          label={`Your time · ${clocks.customerLabel}`}
          zone={clocks.customer}
          at={at}
          ready={ready}
          tone="customer"
          footnote={clocks.detected ? "Detected from this device." : "Chosen by you."}
          action={
            <Button
              ref={changeRef}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing((v) => !v)}
              aria-expanded={editing}
              aria-controls="customer-zone"
            >
              <PencilIcon aria-hidden />
              Change
            </Button>
          }
        />
      </div>
      {editing && (
        <div id="customer-zone" className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <TimeZoneSelect now={at} />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditing(false);
              changeRef.current?.focus();
            }}
          >
            Done
          </Button>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        {clocks.same ? (
          <>
            {clocks.providerLabel} time is the same as yours, so every time below is also your time.
          </>
        ) : (
          <>
            <strong className="font-semibold text-foreground">
              All times are {clocks.providerLabel} time
            </strong>
            , the time at {providerName}. {clocks.providerLabel} is {ready ? gap.text : "…"}; your{" "}
            {clocks.customerLabel} time is shown under each one.
          </>
        )}
      </p>
    </section>
  );
}

function Clock({
  icon,
  label,
  zone,
  at,
  ready,
  tone,
  footnote,
  action,
}: {
  icon: ReactNode;
  label: string;
  zone: Zone;
  at: number;
  ready: boolean;
  tone: "provider" | "customer";
  footnote: string;
  action?: ReactNode;
}) {
  const wall = toWallClock(zone, at);
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4",
        tone === "provider" ? "border-primary/40 bg-accent/60" : "bg-card",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
          tone === "provider" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{label}</span>
        {ready ? (
          <span className="flex flex-wrap items-baseline gap-x-2">
            <time className="font-heading text-2xl font-semibold tabular-nums" dateTime={new Date(at).toISOString()}>
              {formatClock(wall.minutes)}
            </time>
            <span className="text-sm text-muted-foreground">
              {formatPlainDate(wall.date)} · {formatOffset(offsetMinutes(zone, at))}
            </span>
          </span>
        ) : (
          <Skeleton className="my-1 h-7 w-40" />
        )}
        <span className="text-xs text-muted-foreground">{footnote}</span>
      </div>
      {action}
    </div>
  );
}
