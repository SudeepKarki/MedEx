"use client";

import { AlertTriangleIcon, ArrowDownIcon, CircleAlertIcon, RefreshCwIcon, WifiOffIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { Alternative } from "../domain/alternatives";
import type { ConfirmFailure } from "../domain/confirm";
import { daysBetween, formatClock, formatPlainDate, parseClock, type PlainDate } from "../domain/plain-date";
import { formatCustomerTime, formatDuration } from "../domain/two-clocks";
import type { Provider } from "../domain/types";
import type { SlotChoice } from "../hooks/selection";
import type { Clocks } from "../hooks/use-clocks";
import type { PendingConfirm } from "../state/confirm-attempt";
import { AppointmentTime, GroupRun } from "./appointment-time";

export interface ConfirmView {
  sending: boolean;
  unknown: PendingConfirm | null;
  unknownDetail: string | null;
  failure: ConfirmFailure | null;
  /** The date and time the failed attempt asked for (for "10:40 AM was just taken"). */
  failedDate: PlainDate | null;
  failedTime: string | null;
  alternatives: Alternative[] | null;
  nextDate: PlainDate | null;
  onCheck: () => void;
  onAlternative: (alt: Alternative) => void;
  onPickDate: (date: PlainDate) => void;
}

/**
 * Right-hand summary: what will be booked (both clocks), the confirm button,
 * and everything that can happen after pressing it. The button is disabled,
 * with the reason shown, whenever confirming isn't safe.
 */
export function BookingSummary({
  provider,
  date,
  slot,
  people,
  clocks,
  online,
  slotProblem,
  waitingFor,
  validationError,
  confirm,
  move,
  submitRef,
}: {
  provider: Provider;
  date: PlainDate | null;
  slot: SlotChoice | null;
  people: number;
  clocks: Clocks;
  online: boolean;
  /** Why the chosen time can't be booked any more (taken, started, too few in a row). */
  slotProblem: string | null;
  /** The chosen date's slots haven't loaded (yet, or at all), so the choice can't be checked. */
  waitingFor: "times-loading" | "times-failed" | null;
  validationError: string | null;
  confirm: ConfirmView;
  move: { from: { date: PlainDate; startTime: string } } | null;
  submitRef: RefObject<HTMLButtonElement | null>;
}) {
  const specialist = slot ? provider.specialists.find((s) => s.id === slot.specialistId) : undefined;
  const ready = Boolean(date && slot && specialist && !slotProblem);
  const verb = move ? "Move to" : "Book";
  const blocked = !online
    ? "You're offline. Reconnect to confirm; your choices are kept."
    : confirm.unknown
      ? "Waiting to hear whether your last request went through."
      : !slot
        ? "Choose a time first."
        : waitingFor === "times-failed"
          ? "We couldn't load this day's times, so we can't check this one is still free. Try again above."
          : waitingFor === "times-loading"
            ? "Checking the latest times…"
            : null;

  return (
    <section aria-labelledby="summary-heading" className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-xs">
      <h2 id="summary-heading" className="font-heading text-lg font-semibold">
        {move ? "Your change" : "Your appointment"}
      </h2>

      {move ? (
        <MoveDiff from={move.from} to={date && slot && !slotProblem ? { date, startTime: slot.startTime } : null} clocks={clocks} />
      ) : date && slot && specialist ? (
        <div className="flex flex-col gap-2">
          <AppointmentTime date={date} startTime={slot.startTime} clocks={clocks} struck={Boolean(slotProblem)} />
          <p className="text-sm">
            <span className="font-medium">{specialist.name}</span>
            <span className="text-muted-foreground"> · {specialist.speciality}</span>
          </p>
          <p className="text-sm text-muted-foreground">{provider.name}</p>
          <GroupRun specialist={specialist} startTime={slot.startTime} people={people} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Choose a date and a time. We&apos;ll show it here in {clocks.providerLabel} time
          {clocks.same ? "" : ` and in your ${clocks.customerLabel} time`}.
        </p>
      )}

      {move && specialist && slot && <GroupRun specialist={specialist} startTime={slot.startTime} people={people} />}

      <Outcome provider={provider} confirm={confirm} clocks={clocks} online={online} />

      {slotProblem && !confirm.failure && (
        <p role="alert" className="flex gap-2 text-sm text-destructive">
          <CircleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          {slotProblem}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button
          ref={submitRef}
          type="submit"
          size="lg"
          className="w-full"
          disabled={!ready || Boolean(blocked) || confirm.sending}
          aria-describedby="confirm-hint"
        >
          {confirm.sending ? (
            <>
              <Spinner aria-hidden />
              {move ? "Moving…" : "Booking…"}
            </>
          ) : ready && date && slot ? (
            `${verb} ${formatPlainDate(date)}, ${formatClock(parseClock(slot.startTime) ?? 0)}`
          ) : move ? (
            "Move appointment"
          ) : (
            "Book appointment"
          )}
        </Button>
        <p id="confirm-hint" className="min-h-5 text-sm text-muted-foreground" aria-live="polite">
          {confirm.sending ? <SlowHint providerName={provider.name} /> : (blocked ?? validationError)}
        </p>
      </div>
    </section>
  );
}

function SlowHint({ providerName }: { providerName: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 3000);
    return () => window.clearTimeout(timer);
  }, []);
  return slow
    ? `Still waiting for ${providerName}'s booking system. This can take a little while; please keep this page open.`
    : "Sending your booking…";
}

function MoveDiff({
  from,
  to,
  clocks,
}: {
  from: { date: PlainDate; startTime: string };
  to: { date: PlainDate; startTime: string } | null;
  clocks: Clocks;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-xl border border-dashed p-3">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">From (current)</p>
        <AppointmentTime date={from.date} startTime={from.startTime} clocks={clocks} struck={Boolean(to)} className="opacity-80" />
      </div>
      <ArrowDownIcon aria-hidden className="mx-auto size-5 text-muted-foreground" />
      <div className={cn("rounded-xl border p-3", to ? "border-primary bg-accent/50" : "border-dashed")}>
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">To (new)</p>
        {to ? (
          <>
            <AppointmentTime date={to.date} startTime={to.startTime} clocks={clocks} />
            <p className="mt-1 text-sm font-medium">{describeShift(from, to)}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Choose a new date and time.</p>
        )}
      </div>
    </div>
  );
}

/** "2 days later, 40 min earlier in the day" */
export function describeShift(from: { date: PlainDate; startTime: string }, to: { date: PlainDate; startTime: string }) {
  const days = daysBetween(from.date, to.date);
  const minutes = (parseClock(to.startTime) ?? 0) - (parseClock(from.startTime) ?? 0);
  const dayPart = days === 0 ? "Same day" : `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} ${days > 0 ? "later" : "earlier"}`;
  const timePart =
    minutes === 0 ? "same time" : `${formatDuration(minutes)} ${minutes > 0 ? "later" : "earlier"}${days === 0 ? "" : " in the day"}`;
  return `${dayPart}, ${timePart}`;
}

function Outcome({ provider, confirm, clocks, online }: { provider: Provider; confirm: ConfirmView; clocks: Clocks; online: boolean }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const kind = confirm.unknown ? "unknown" : confirm.failure?.kind;
  // Move focus to what happened, so keyboard and screen-reader users land on it
  useEffect(() => {
    if (kind) headingRef.current?.focus();
  }, [kind]);

  if (confirm.unknown) {
    const r = confirm.unknown.request;
    return (
      <Alert className="border-warning bg-warning-muted text-warning-foreground">
        <AlertTriangleIcon aria-hidden />
        <AlertTitle>
          <h3 ref={headingRef} tabIndex={-1} className="outline-none">
            We don&apos;t know yet if it went through
          </h3>
        </AlertTitle>
        <AlertDescription className="text-warning-foreground">
          <p>
            Your request for {formatPlainDate(r.date)}, {formatClock(parseClock(r.startTime) ?? 0)} ({clocks.providerLabel}{" "}
            time) was sent to {provider.name}, but we haven&apos;t had an answer.
          </p>
          {confirm.unknownDetail && <p>{confirm.unknownDetail}</p>}
          <p>Your choices are locked until we know, so you can&apos;t book twice by accident.</p>
          {online ? (
            <Button type="button" size="sm" className="mt-2" onClick={confirm.onCheck}>
              <RefreshCwIcon aria-hidden />
              Check now
            </Button>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 font-medium">
              <WifiOffIcon aria-hidden className="size-4" />
              We&apos;ll check as soon as you&apos;re back online.
            </p>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  const failure = confirm.failure;
  if (!failure) return null;

  if (failure.kind === "taken") {
    const wanted = confirm.failedTime ? formatClock(parseClock(confirm.failedTime) ?? 0) : "That time";
    return (
      <Alert variant="destructive">
        <CircleAlertIcon aria-hidden />
        <AlertTitle>
          <h3 ref={headingRef} tabIndex={-1} className="outline-none">
            {failure.unavailable ? `${wanted} can't be booked any more` : `${wanted} was just taken`}
          </h3>
        </AlertTitle>
        <AlertDescription>
          <p>{failure.message} Nothing was booked, and everything else you chose is kept.</p>
          {confirm.failedDate && <Alternatives confirm={confirm} clocks={clocks} provider={provider} date={confirm.failedDate} />}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <CircleAlertIcon aria-hidden />
      <AlertTitle>
        <h3 ref={headingRef} tabIndex={-1} className="outline-none">
          That didn&apos;t work
        </h3>
      </AlertTitle>
      <AlertDescription>
        <p>{failure.message}</p>
        <p>Your choices are kept, so you can simply try again.</p>
      </AlertDescription>
    </Alert>
  );
}

function Alternatives({
  confirm,
  clocks,
  provider,
  date,
}: {
  confirm: ConfirmView;
  clocks: Clocks;
  provider: Provider;
  date: PlainDate;
}) {
  if (confirm.alternatives === null) {
    return <p className="mt-2 text-sm">Finding the nearest free times…</p>;
  }
  if (confirm.alternatives.length === 0) {
    return confirm.nextDate ? (
      <Choice>
        <p className="text-sm">There are no other free times that day.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => confirm.onPickDate(confirm.nextDate!)}>
          See {formatPlainDate(confirm.nextDate)}
        </Button>
      </Choice>
    ) : (
      <p className="mt-2 text-sm">There are no other free times in the next 90 days with these choices.</p>
    );
  }
  return (
    <Choice>
      <p className="text-sm font-medium text-foreground">Closest free times:</p>
      <div className="flex flex-wrap gap-2">
        {confirm.alternatives.map((alt) => {
          const name = provider.specialists.find((s) => s.id === alt.specialistId)?.name;
          const multi = new Set(confirm.alternatives!.map((a) => a.specialistId)).size > 1;
          return (
            <Button
              key={`${alt.specialistId}|${alt.startMinutes}`}
              type="button"
              size="sm"
              variant="outline"
              className="h-auto flex-col gap-0 py-1.5 text-foreground"
              onClick={() => confirm.onAlternative(alt)}
              aria-label={`Choose ${formatClock(alt.startMinutes)} ${clocks.providerLabel} time${
                clocks.same ? "" : `, ${formatCustomerTime(clocks.dual(date, alt.startMinutes))} your time`
              }${name ? `, with ${name}` : ""}`}
            >
              <span className="font-semibold tabular-nums">
                {formatClock(alt.startMinutes)}
                {multi && name ? ` · ${name}` : ""}
              </span>
              {!clocks.same && (
                <span className="text-xs font-normal text-muted-foreground tabular-nums">
                  {formatCustomerTime(clocks.dual(date, alt.startMinutes))} yours
                </span>
              )}
            </Button>
          );
        })}
      </div>
    </Choice>
  );
}

function Choice({ children }: { children: ReactNode }) {
  return <div className="mt-2 flex flex-col gap-2">{children}</div>;
}

