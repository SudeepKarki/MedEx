"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { announce } from "@/components/app/live-announcer";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useRegisterDevActions } from "@/lib/mock-controls/dev-actions";
import { useRegisterMockEndpoints } from "@/lib/mock-controls/use-register-mock-endpoints";
import { createBooking, moveBooking, resetDemo, type Booking, type ProviderData } from "../api/client";
import { BOOKING_ENDPOINT_LIST } from "../api/endpoints";
import { closestAlternatives, type Alternative } from "../domain/alternatives";
import { describeDay, nextAvailableDate, type DayStatus } from "../domain/availability";
import { addDays, formatClock, formatPlainDate, parseClock, toClock, type PlainDate } from "../domain/plain-date";
import type { Provider } from "../domain/types";
import { selectionSchema, selectionToSearch, type BookingSelection, type SlotChoice } from "../hooks/selection";
import { bookingKeys, useAvailability, useSlots } from "../hooks/queries";
import { useClocks } from "../hooks/use-clocks";
import { useConfirm } from "../hooks/use-confirm";
import { useConfirmAttempts } from "../state/confirm-attempt";
import { providerNowFrom } from "../state/server-clock";
import { BookingCalendar, CalendarSkeleton } from "./booking-calendar";
import { BookingSummary } from "./booking-summary";
import { ClockStrip } from "./clock-strip";
import { ProviderHeader } from "./provider-header";
import { SlotPanel, SlotsSkeleton } from "./slot-panel";
import { PeoplePicker, SpecialistPicker } from "./specialist-picker";
import { InlineError } from "./states";

export type FlowMode = { kind: "new" } | { kind: "reschedule"; booking: Booking };

/**
 * The booking page, for a new booking or a reschedule. The customer's choices
 * live in one form (React Hook Form), mirrored into the URL so a reload, a
 * failed request or a 409 never loses them. Everything shown is derived from
 * those choices plus three queries: availability (90 days), the chosen day's
 * slots, and the server's clock.
 */
export function BookingFlow({ data, mode, initial }: { data: ProviderData; mode: FlowMode; initial: BookingSelection }) {
  useRegisterMockEndpoints(BOOKING_ENDPOINT_LIST);
  const queryClient = useQueryClient();
  useRegisterDevActions(useMemo(() => devActions(queryClient), [queryClient]));

  const { provider } = data;
  const router = useRouter();
  const pathname = usePathname();
  const online = useOnlineStatus();
  const clocks = useClocks(provider);
  const booking = mode.kind === "reschedule" ? mode.booking : null;
  const scope = booking ? `move:${booking.bookingId}` : `create:${provider.id}`;

  const [lastRequest, setLastRequest] = useState<{ date: PlainDate; slot: SlotChoice } | null>(null);
  const confirmer = useConfirm({
    scope,
    providerId: provider.id,
    send: (request, key) =>
      booking
        ? moveBooking(booking.bookingId, { date: request.date, startTime: request.startTime })
        : createBooking({ ...request, providerId: provider.id, idempotencyKey: key }),
    onConfirmed: (result) => {
      announce(booking ? "Your appointment has been moved." : "Your appointment is booked.", "assertive");
      const params = booking ? `status=moved&from=${booking.date}T${booking.startTime}` : "status=booked";
      router.push(`/bookings/${encodeURIComponent(result.bookingId)}?${params}`);
    },
  });

  // An unanswered attempt (maybe from before a reload) wins over the URL: it's what was sent
  const pendingAtStart = useConfirmAttempts.getState().pending[scope];
  const form = useForm<BookingSelection>({
    resolver: zodResolver(selectionSchema),
    defaultValues: pendingAtStart
      ? {
          specialistId: booking ? null : initial.specialistId,
          people: pendingAtStart.request.numberOfPeople,
          date: pendingAtStart.request.date,
          slot: { specialistId: pendingAtStart.request.specialistId, startTime: pendingAtStart.request.startTime },
        }
      : initial,
  });
  const [specialistChoice, peopleChoice, date, slot] = useWatch({
    control: form.control,
    name: ["specialistId", "people", "date", "slot"],
  });
  const slotError = form.formState.errors.slot?.message ?? null;

  // Mirror the choices into the URL (replace, not push: choosing isn't navigating)
  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: ({ values }) => window.history.replaceState(null, "", `${pathname}${selectionToSearch(values)}`),
      }),
    [form, pathname],
  );

  // Rescheduling keeps the specialist and the group; only the date and time change
  const specialistId = booking ? booking.specialistId : specialistChoice;
  const people = booking ? booking.numberOfPeople : peopleChoice;
  const current = booking
    ? {
        date: booking.date,
        specialistId: booking.specialistId,
        slotTimes: booking.slotTimes ?? [booking.startTime],
      }
    : undefined;
  const locked = confirmer.isSending || confirmer.unknown !== null;

  const availability = useAvailability(
    provider.id,
    { specialistId, people, exceptBooking: booking?.bookingId },
    true,
  );
  const slots = useSlots(provider.id, date);
  const ready = clocks.minute > 0;
  const now = ready ? providerNowFrom(clocks.provider, clocks.minute) : null;
  const days = availability.data?.days;
  const today = days?.[0]?.date ?? now?.today ?? null;

  // No date chosen yet: start on the earliest day with something free (or the current appointment's day)
  const settled = availability.data && !availability.isPlaceholderData;
  useEffect(() => {
    if (date || !settled || !days) return;
    const currentDay = booking && days.find((d) => d.date === booking.date && d.status.kind === "available");
    const first = currentDay?.date ?? nextAvailableDate(days, days[0]!.date) ?? days[0]!.date;
    form.setValue("date", first);
  }, [date, settled, days, booking, form]);

  const day =
    date && slots.data && now
      ? describeDay({
          provider,
          date,
          now,
          specialistId,
          people,
          booked: new Set(slots.data.filter((s) => s.isBooked).map((s) => `${s.specialistId}|${s.startTime}`)),
          current,
        })
      : null;

  const chosen = slot && day ? day.specialists.find((d) => d.specialist.id === slot.specialistId)?.slots.find((s) => toClock(s.startMinutes) === slot.startTime) : undefined;
  const slotProblem = !slot || !day ? null : problemWith(slot, chosen, people);

  const nextFrom = (from: PlainDate) =>
    days ? (nextAvailableDate(days, addDays(from, 1)) ?? nextAvailableDate(days, days[0]!.date)) : null;
  const nextAvailable = availability.data?.nextAvailable;
  const specialistHasNone = Boolean(specialistId && nextAvailable && nextAvailable[specialistId] === null);
  const suggestions = {
    nextDate: date ? nextFrom(date) : null,
    specialistHasNone,
    otherSpecialists:
      specialistHasNone && !booking && nextAvailable
        ? provider.specialists.flatMap((s) =>
            s.id !== specialistId && nextAvailable[s.id] ? [{ specialist: s, nextAvailable: nextAvailable[s.id]! }] : [],
          )
        : [],
  };

  const failure = confirmer.failure;
  const alternatives: Alternative[] | null =
    failure?.kind === "taken" && lastRequest
      ? day && !slots.isFetching && lastRequest.date === date
        ? closestAlternatives(
            day.specialists,
            { specialistId: lastRequest.slot.specialistId, startMinutes: parseClock(lastRequest.slot.startTime) ?? 0 },
            { anySpecialist: specialistId === null },
          )
        : null
      : null;

  const submitRef = useRef<HTMLButtonElement>(null);
  const chooseSlot = (choice: SlotChoice, focusConfirm = false) => {
    form.setValue("slot", choice);
    form.clearErrors("slot");
    confirmer.clearFailure();
    const minutes = parseClock(choice.startTime) ?? 0;
    const time = clocks.dual(date!, minutes);
    const who = provider.specialists.find((s) => s.id === choice.specialistId)?.name;
    announce(
      `Chosen: ${formatClock(minutes)} ${clocks.providerCity} time${clocks.same ? "" : `, ${formatClock(time.customer.minutes)} your time`}${who ? `, with ${who}` : ""}.`,
    );
    if (focusConfirm) requestAnimationFrame(() => submitRef.current?.focus());
  };
  const pickDate = (next: PlainDate) => {
    form.setValue("date", next);
    form.setValue("slot", null);
    confirmer.clearFailure();
  };

  const onSubmit = form.handleSubmit(
    (values) => {
      if (!values.date || !values.slot || slotProblem) return;
      setLastRequest({ date: values.date, slot: values.slot });
      confirmer.confirm({
        specialistId: values.slot.specialistId,
        date: values.date,
        startTime: values.slot.startTime,
        numberOfPeople: people,
      });
    },
    () => announce("Choose a time to continue.", "assertive"),
  );

  const dateHeading = date ? formatPlainDate(date, "long") : null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
      <ProviderHeader
        provider={provider}
        title={booking ? "Move your appointment" : `Book an appointment`}
        eyebrow={booking ? `Booking ${booking.bookingId}` : undefined}
        now={clocks.minute * 60_000}
      />
      <ClockStrip clocks={clocks} providerName={provider.name} />

      <form onSubmit={onSubmit} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Step n={1} title={booking ? "Your appointment" : "Specialist and group size"} id="step-who">
            {booking ? (
              <CurrentBookingNote provider={provider} booking={booking} days={days} />
            ) : (
              <div className="flex flex-col gap-5">
                <SpecialistPicker
                  provider={provider}
                  value={specialistChoice}
                  onChange={(id) => {
                    form.setValue("specialistId", id);
                    if (slot && id && slot.specialistId !== id) form.setValue("slot", null);
                    confirmer.clearFailure();
                  }}
                  nextAvailable={nextAvailable}
                  providerCity={clocks.providerCity}
                  disabled={locked}
                />
                <PeoplePicker
                  value={peopleChoice}
                  onChange={(n) => {
                    form.setValue("people", n);
                    confirmer.clearFailure();
                  }}
                  disabled={locked}
                />
              </div>
            )}
          </Step>

          <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
            <Step n={2} title="Choose a date" id="step-date" note={`Dates at ${provider.name}, in ${clocks.providerCity}.`}>
              {availability.isError && !days ? (
                <InlineError
                  error={availability.error}
                  onRetry={() => availability.refetch()}
                  retrying={availability.isFetching}
                  what="the calendar"
                />
              ) : !days || !today ? (
                <SlowArea loading label="Loading the calendar">
                  <CalendarSkeleton />
                </SlowArea>
              ) : (
                <BookingCalendar
                  days={days}
                  today={today}
                  selected={date}
                  onSelect={pickDate}
                  marked={booking ? { date: booking.date, label: "Your current appointment" } : null}
                  updating={availability.isPlaceholderData}
                  disabled={locked}
                  labelledBy="step-date"
                />
              )}
            </Step>

            <Step
              n={3}
              title={dateHeading ? `Choose a time on ${dateHeading}` : "Choose a time"}
              id="step-time"
              note={clocks.same ? undefined : `${clocks.providerCity} time, with your ${clocks.customerCity} time underneath.`}
            >
              {!date ? (
                days ? (
                  <p className="text-sm text-muted-foreground">Choose a date to see its times.</p>
                ) : (
                  <SlotsSkeleton />
                )
              ) : slots.isError && !slots.data ? (
                <InlineError error={slots.error} onRetry={() => slots.refetch()} retrying={slots.isFetching} what="the times" />
              ) : !day ? (
                <SlowArea loading label="Loading times">
                  <SlotsSkeleton />
                </SlowArea>
              ) : (
                <SlotPanel
                  provider={provider}
                  date={date}
                  status={day.status}
                  specialists={day.specialists}
                  people={people}
                  selected={slot}
                  clocks={clocks}
                  disabled={locked}
                  suggestions={suggestions}
                  onChoose={(choice) => chooseSlot(choice)}
                  onPickDate={pickDate}
                  onPickSpecialist={(id, next) => {
                    form.setValue("specialistId", id);
                    pickDate(next);
                  }}
                />
              )}
              {slotError && !slot && (
                <p role="alert" className="text-sm text-destructive">
                  {slotError}
                </p>
              )}
            </Step>
          </div>
        </div>

        <aside className="lg:sticky lg:top-20" aria-label="Summary">
          <BookingSummary
            provider={provider}
            date={date}
            slot={slot}
            people={people}
            clocks={clocks}
            online={online}
            slotProblem={slotProblem}
            checking={slots.isFetching && !slots.data}
            validationError={slotError}
            submitRef={submitRef}
            move={booking ? { from: { date: booking.date, startTime: booking.startTime } } : null}
            confirm={{
              sending: confirmer.isSending,
              unknown: confirmer.unknown,
              failure,
              failedDate: lastRequest?.date ?? null,
              failedTime: lastRequest?.slot.startTime ?? null,
              alternatives,
              nextDate: lastRequest ? nextFrom(lastRequest.date) : null,
              onCheck: () => confirmer.check(),
              onAlternative: (alt) => chooseSlot({ specialistId: alt.specialistId, startTime: toClock(alt.startMinutes) }, true),
              onPickDate: pickDate,
            }}
          />
        </aside>
      </form>
    </div>
  );
}

function problemWith(slot: SlotChoice, chosen: { state: string; bookable: boolean } | undefined, people: number): string | null {
  const time = formatClock(parseClock(slot.startTime) ?? 0);
  if (!chosen) return `${time} isn't offered on this day. Choose another time.`;
  if (chosen.bookable) return null;
  switch (chosen.state) {
    case "booked":
      return `${time} has just been booked by someone else. Choose another time.`;
    case "started":
      return `${time} has already started. Choose a later time.`;
    case "current":
      return `${time} is your current appointment. Choose a different time to move it.`;
    default:
      return `${time} doesn't have ${people} free times in a row. Choose another start time.`;
  }
}

function Step({ n, title, id, note, children }: { n: number; title: string; id: string; note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card/60 p-4 sm:p-5">
      <div className="flex flex-col gap-0.5">
        <h2 id={id} className="flex items-center gap-2.5 font-heading text-lg font-semibold">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground"
          >
            {n}
          </span>
          {title}
        </h2>
        {note && <p className="pl-9.5 text-sm text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** Skeleton area that, after a few seconds, says it's still loading (slow network). */
function SlowArea({ loading, label, children }: { loading: boolean; label: string; children: ReactNode }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setSlow(true), 2500);
    return () => window.clearTimeout(timer);
  }, [loading]);
  return (
    <div role="status" aria-label={label} aria-busy={loading} className="flex flex-col gap-3">
      {children}
      <p className="min-h-5 text-sm text-muted-foreground">{slow ? "Still loading. The connection seems slow…" : ""}</p>
    </div>
  );
}

function CurrentBookingNote({ provider, booking, days }: { provider: Provider; booking: Booking; days: { date: PlainDate; status: DayStatus }[] | undefined }) {
  const specialist = provider.specialists.find((s) => s.id === booking.specialistId);
  const status = days?.find((d) => d.date === booking.date)?.status;
  const closedThatDay = status?.kind === "closed" || status?.kind === "closure";
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        With <span className="font-medium">{specialist?.name ?? "your specialist"}</span>
        {specialist && <span className="text-muted-foreground"> ({specialist.speciality})</span>}, for{" "}
        {booking.numberOfPeople === 1 ? "1 person" : `${booking.numberOfPeople} people`}. You can change the date and
        time; to see someone else, make a new booking.
      </p>
      {closedThatDay && (
        <p className="rounded-lg bg-warning-muted px-3 py-2 text-warning-foreground">
          Your current appointment is on {formatPlainDate(booking.date, "long")}, but {provider.name}&apos;s listed hours
          say it&apos;s closed that day. Your booking still stands; you may want to move it or check with them.
        </p>
      )}
    </div>
  );
}

function devActions(queryClient: ReturnType<typeof useQueryClient>) {
  return [
    {
      id: "booking.reset",
      label: "Reset demo bookings",
      description: "Restore the booked slots and the existing booking from the JSON file.",
      run: async () => {
        await resetDemo();
        useConfirmAttempts.setState({ pending: {} });
        await queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      },
    },
  ];
}
