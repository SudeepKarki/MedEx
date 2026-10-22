"use client";

import { AlertTriangleIcon, StethoscopeIcon, UsersIcon } from "lucide-react";
import { useId } from "react";
import { NativeRadio } from "@/components/form/native-checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatClock, formatPlainDate, type PlainDate } from "../domain/plain-date";
import { MAX_PEOPLE, type Provider } from "../domain/types";

const cardClass =
  "flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/60 has-checked:border-primary has-checked:bg-accent/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-disabled:cursor-not-allowed has-disabled:opacity-60";

/**
 * Native radios in cards: arrow keys move between them, the group is
 * announced with its legend, and each card says when that specialist is
 * next free, so a dead end is visible before it's chosen.
 */
export function SpecialistPicker({
  provider,
  value,
  onChange,
  nextAvailable,
  providerCity,
  disabled,
}: {
  provider: Provider;
  value: string | null;
  onChange: (specialistId: string | null) => void;
  /** undefined while loading */
  nextAvailable: Record<string, PlainDate | null> | undefined;
  providerCity: string;
  disabled: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">Who would you like to see?</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={cardClass}>
          <NativeRadio name={name} className="mt-1" checked={value === null} onChange={() => onChange(null)} />
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">Any specialist</span>
            <span className="text-sm text-muted-foreground">See everyone&apos;s free times for the day.</span>
          </span>
        </label>
        {provider.specialists.map((specialist) => {
          const next = nextAvailable?.[specialist.id];
          const c = specialist.consultation;
          return (
            <label key={specialist.id} className={cardClass}>
              <NativeRadio
                name={name}
                className="mt-1"
                checked={value === specialist.id}
                onChange={() => onChange(specialist.id)}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">{specialist.name}</span>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <StethoscopeIcon aria-hidden className="size-3.5" />
                  {specialist.speciality}
                </span>
                <span className="text-sm text-muted-foreground">
                  Sees patients {formatClock(c.startMinutes)} – {formatClock(c.endMinutes)} ({providerCity}),{" "}
                  {c.durationMinutes} min each
                </span>
                {nextAvailable === undefined ? (
                  <Skeleton className="mt-1 h-4 w-32" />
                ) : next ? (
                  <span className="text-sm font-medium text-success">Next free: {formatPlainDate(next)}</span>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm font-medium text-warning-foreground">
                    <AlertTriangleIcon aria-hidden className="size-3.5" />
                    No free times in the next 90 days
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Segmented 1–4: native radios (arrow keys, legend), styled as buttons. */
export function PeoplePicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (people: number) => void;
  disabled: boolean;
}) {
  const name = useId();
  const hintId = useId();
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled} aria-describedby={hintId}>
      <legend className="mb-2 text-sm font-medium">How many people?</legend>
      <div className="inline-flex w-fit rounded-lg border bg-card p-1">
        {Array.from({ length: MAX_PEOPLE }, (_, i) => i + 1).map((n) => (
          <label
            key={n}
            className={cn(
              "flex min-h-11 min-w-14 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
              "hover:bg-muted has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
            )}
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
            />
            {n === 1 ? null : <UsersIcon aria-hidden className="size-4" />}
            {n}
            <span className="sr-only">{n === 1 ? "person" : "people"}</span>
          </label>
        ))}
      </div>
      <p id={hintId} className="text-sm text-muted-foreground">
        {value === 1
          ? "Booking for more than one? Each person gets their own appointment, back to back."
          : `We'll book ${value} appointments back to back with the same specialist.`}
      </p>
    </fieldset>
  );
}
