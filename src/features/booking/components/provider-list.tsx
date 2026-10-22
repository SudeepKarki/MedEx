"use client";

import { ArrowRightIcon, CalendarClockIcon, InfoIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { formatClock } from "../domain/plain-date";
import { toWallClock, zoneCity } from "../domain/timezone";
import { useProviders } from "../hooks/queries";
import { useServerMinute } from "../state/server-clock";
import { zoneDisclosure } from "./provider-header";
import { InlineError } from "./states";

const EXISTING_BOOKING = "BK-20261008-0042";

/** /book: pick a provider (not in the brief; the demo's way in), or reschedule the existing booking. */
export function ProviderList() {
  const providers = useProviders();
  const minute = useServerMinute();
  const at = minute * 60_000;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Book an appointment</h1>
        <p className="max-w-2xl text-muted-foreground">
          Choose where you&apos;d like to go. Times are always shown on the clock at the provider, with your own time
          alongside.
        </p>
      </header>

      <Link
        href={`/bookings/${EXISTING_BOOKING}/reschedule`}
        className="flex items-center gap-3 rounded-xl border border-primary/40 bg-accent/50 p-4 transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <CalendarClockIcon aria-hidden className="size-5 shrink-0 text-primary" />
        <span className="flex flex-1 flex-col">
          <span className="font-medium">Reschedule booking {EXISTING_BOOKING}</span>
          <span className="text-sm text-muted-foreground">Your existing appointment at Riverside International Hospital</span>
        </span>
        <ArrowRightIcon aria-hidden className="size-4" />
      </Link>

      {providers.isError ? (
        <InlineError error={providers.error} onRetry={() => providers.refetch()} retrying={providers.isFetching} what="the providers" />
      ) : !providers.data ? (
        <ul className="grid gap-3 sm:grid-cols-2" aria-label="Loading providers" aria-busy>
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i}>
              <Skeleton className="h-36 rounded-xl" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {providers.data.map(({ provider }) => {
            const disclosure = at > 0 ? zoneDisclosure(provider.timeZone, at) : null;
            return (
              <li key={provider.id}>
                <Link
                  href={`/book/${provider.id}`}
                  className="flex h-full flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-medium">{provider.name}</span>
                    {at > 0 && (
                      <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                        {formatClock(toWallClock(provider.timeZone.zone, at).minutes)} there
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPinIcon aria-hidden className="size-4" />
                    {zoneCity(provider.timeZone.zone)} time · {provider.specialists.length}{" "}
                    {provider.specialists.length === 1 ? "specialist" : "specialists"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {provider.specialists.map((s) => s.speciality).join(", ")}
                  </span>
                  {disclosure && (
                    <span className="mt-auto flex items-start gap-1.5 text-xs text-muted-foreground">
                      <InfoIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                      {disclosure}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
