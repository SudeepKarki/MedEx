"use client";

import { keepPreviousData, queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import { fetchAvailability, fetchBooking, fetchProvider, fetchProviders, fetchSlots } from "../api/client";
import type { PlainDate } from "../domain/plain-date";

export const bookingKeys = {
  all: ["booking"] as const,
  providers: () => [...bookingKeys.all, "providers"] as const,
  provider: (id: number) => [...bookingKeys.all, "provider", id] as const,
  availability: (id: number) => [...bookingKeys.all, "availability", id] as const,
  slots: (id: number) => [...bookingKeys.all, "slots", id] as const,
  booking: (id: string) => [...bookingKeys.all, "booking", id] as const,
};

export function useProviders() {
  return useQuery({ queryKey: bookingKeys.providers(), queryFn: ({ signal }) => fetchProviders(signal) });
}

export const providerQuery = (id: number) =>
  queryOptions({ queryKey: bookingKeys.provider(id), queryFn: ({ signal }) => fetchProvider(id, signal) });

export function useProvider(id: number, enabled = true) {
  return useQuery({ ...providerQuery(id), enabled });
}

/**
 * `today` is the provider's date by the server's clock. It's part of the key,
 * so a page left open past the provider's midnight fetches the new window.
 */
export function useAvailability(
  providerId: number,
  options: { specialistId: string | null; people: number; exceptBooking?: string },
  today: PlainDate | null,
) {
  return useQuery({
    queryKey: [...bookingKeys.availability(providerId), options, today],
    queryFn: ({ signal }) => fetchAvailability(providerId, options, signal),
    enabled: today !== null,
    // Availability changes as people book, so it's fresh for a minute, not five
    staleTime: 60_000,
    // Changing the specialist or group size keeps the old calendar on screen (marked as updating)
    placeholderData: keepPreviousData,
  });
}

/**
 * Every specialist's slots for the day in one request, so switching specialist
 * filters what's already loaded instead of fetching again.
 */
export function useSlots(providerId: number, date: PlainDate | null) {
  return useQuery({
    queryKey: [...bookingKeys.slots(providerId), date],
    queryFn: ({ signal }) => fetchSlots(providerId, date!, null, signal),
    enabled: date !== null,
    staleTime: 30_000,
  });
}

export function useBooking(bookingId: string) {
  return useQuery({ queryKey: bookingKeys.booking(bookingId), queryFn: ({ signal }) => fetchBooking(bookingId, signal) });
}

/** After a booking, a move or a 409, what's free has changed. */
export function invalidateAvailability(queryClient: QueryClient, providerId: number) {
  void queryClient.invalidateQueries({ queryKey: bookingKeys.slots(providerId) });
  void queryClient.invalidateQueries({ queryKey: bookingKeys.availability(providerId) });
}
