"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { announce } from "@/components/app/live-announcer";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { createBooking, moveBooking, type Booking, type ProviderData } from "../api/client";
import { describeDay, nextAvailableDate } from "../domain/availability";
import { formatClock, formatPlainDate, parseClock, toClock, type PlainDate } from "../domain/plain-date";
import { formatCustomerTime } from "../domain/two-clocks";
import { alternativesAfterConflict, bookedKeys, daySuggestions, findSlot, nextFreeDay, slotProblem } from "../hooks/day-view";
import { useAvailability, useSlots } from "../hooks/queries";
import { selectionSchema, selectionToSearch, type BookingSelection, type SlotChoice } from "../hooks/selection";
import { useBookingDevTools } from "../hooks/use-booking-dev-tools";
import { useClocks } from "../hooks/use-clocks";
import { useConfirm } from "../hooks/use-confirm";
import { useConfirmAttempts } from "../state/confirm-attempt";
import { providerNowFrom } from "../state/server-clock";
import { BookingCalendar, CalendarSkeleton } from "./booking-calendar";
import { BookingSummary } from "./booking-summary";
import { ClockStrip } from "./clock-strip";
import { CurrentBookingNote, LoadingArea, Step } from "./flow-parts";
import { MobileReviewBar } from "./mobile-review-bar";
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
  useBookingDevTools();
  const { provider } = data;
  const router = useRouter();
  const pathname = usePathname();
  const online = useOnlineStatus();
  const clocks = useClocks(provider);
  const booking = mode.kind === "reschedule" ? mode.booking : null;
  const scope = booking ? `move:${booking.bookingId}` : `create:${provider.id}`;

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
    ? { date: booking.date, specialistId: booking.specialistId, slotTimes: booking.slotTimes ?? [booking.startTime] }
    : undefined;
  // While a confirm is in flight or unanswered, nothing can change
  const locked = confirmer.isSending || confirmer.unknown !== null;

  const now = clocks.minute > 0 ? providerNowFrom(clocks.provider, clocks.minute) : null;
  const availability = useAvailability(
    provider.id,
    { specialistId, people, exceptBooking: booking?.bookingId },
    now?.today ?? null,
  );
  const slots = useSlots(provider.id, date);
  const days = availability.data?.days;
  const today = days?.[0]?.date ?? null;

  // No date chosen yet: start on the earliest day with something free (or the current appointment's day)
  const settled = availability.data && !availability.isPlaceholderData;
  useEffect(() => {
    if (date || !settled || !days?.[0]) return;
    const currentDay = booking && days.find((d) => d.date === booking.date && d.status.kind === "available");
    form.setValue("date", currentDay?.date ?? nextAvailableDate(days, days[0].date) ?? days[0].date);
  }, [date, settled, days, booking, form]);

  const day =
    date && slots.data && now
      ? describeDay({ provider, date, now, specialistId, people, booked: bookedKeys(slots.data), current })
      : null;

  // An unanswered attempt's own slot may well be booked by *them*: don't call it someone else's
  const problem = slot && day && !confirmer.unknown ? slotProblem(slot, findSlot(day.specialists, slot), people) : null;
  // Confirm only against this day's real slots, never against a guess. After a 409 the
  // slots on screen are the ones that said the time was free, so wait for the refetch.
  const waitingFor =
    !date || !slot
      ? null
      : !day
        ? slots.isError
          ? "times-failed"
          : "times-loading"
        : confirmer.failure?.kind === "taken" && slots.isFetching
          ? "times-loading"
          : null;

  const sent = confirmer.lastRequest;
  const wanted = sent ? { date: sent.date, slot: { specialistId: sent.specialistId, startTime: sent.startTime } } : null;
  const alternatives =
    confirmer.failure?.kind === "taken"
      ? alternativesAfterConflict({
          wanted,
          date,
          day: day?.specialists ?? null,
          fresh: !slots.isFetching,
          anySpecialist: specialistId === null,
        })
      : null;

  const submitRef = useRef<HTMLButtonElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const chooseSlot = (choice: SlotChoice, focusConfirm = false) => {
    form.setValue("slot", choice);
    form.clearErrors("slot");
    confirmer.clearFailure();
    const minutes = parseClock(choice.startTime) ?? 0;
    const yours = clocks.same || !date ? "" : `, ${formatCustomerTime(clocks.dual(date, minutes))} your time`;
    const who = provider.specialists.find((s) => s.id === choice.specialistId)?.name;
    announce(`Chosen: ${formatClock(minutes)} ${clocks.providerLabel} time${yours}${who ? `, with ${who}` : ""}.`);
    if (focusConfirm) requestAnimationFrame(() => submitRef.current?.focus());
  };
  const pickDate = (next: PlainDate) => {
    form.setValue("date", next);
    form.setValue("slot", null);
    confirmer.clearFailure();
  };

  const onSubmit = form.handleSubmit(
    (values) => {
      if (!values.date || !values.slot || problem || waitingFor || locked) return;
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
        title={booking ? "Move your appointment" : "Book an appointment"}
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
                  nextAvailable={availability.data?.nextAvailable}
                  providerLabel={clocks.providerLabel}
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
            <Step n={2} title="Choose a date" id="step-date" note={`Dates as they are at ${provider.name} (${clocks.providerLabel}).`}>
              {availability.isError && !days ? (
                <InlineError
                  error={availability.error}
                  onRetry={() => availability.refetch()}
                  retrying={availability.isFetching}
                  what="the calendar"
                />
              ) : !days || !today ? (
                <LoadingArea label="Loading the calendar" offline={!online}>
                  <CalendarSkeleton />
                </LoadingArea>
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
              note={clocks.same ? undefined : `${clocks.providerLabel} time, with your ${clocks.customerLabel} time underneath.`}
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
                <LoadingArea label="Loading times" offline={!online}>
                  <SlotsSkeleton />
                </LoadingArea>
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
                  suggestions={daySuggestions({
                    provider,
                    date,
                    specialistId,
                    availability: availability.data,
                    canSwitchSpecialist: !booking,
                  })}
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

        <aside ref={summaryRef} className="lg:sticky lg:top-20" aria-label="Summary">
          <BookingSummary
            provider={provider}
            date={date}
            slot={slot}
            people={people}
            clocks={clocks}
            online={online}
            slotProblem={problem}
            waitingFor={waitingFor}
            validationError={slotError}
            submitRef={submitRef}
            move={booking ? { from: { date: booking.date, startTime: booking.startTime } } : null}
            confirm={{
              sending: confirmer.isSending,
              unknown: confirmer.unknown,
              unknownDetail: confirmer.unknownDetail,
              failure: confirmer.failure,
              failedDate: wanted?.date ?? null,
              failedTime: wanted?.slot.startTime ?? null,
              alternatives,
              nextDate: wanted ? nextFreeDay(days, wanted.date) : null,
              onCheck: () => confirmer.check(),
              onAlternative: (alt) => chooseSlot({ specialistId: alt.specialistId, startTime: toClock(alt.startMinutes) }, true),
              onPickDate: pickDate,
            }}
          />
        </aside>
      </form>
      {date && slot && day && !problem && !locked && (
        <>
          <MobileReviewBar date={date} startTime={slot.startTime} clocks={clocks} summaryRef={summaryRef} submitRef={submitRef} />
          {/* room for the bar, so it never covers the end of the page */}
          <div aria-hidden className="h-16 lg:hidden" />
        </>
      )}
    </div>
  );
}
