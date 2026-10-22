import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { apiRequest } from "@/lib/api/http-client";
import type { DayStatus } from "../domain/availability";
import { normalizeProvider, type ProviderIssue } from "../domain/normalize";
import type { PlainDate } from "../domain/plain-date";
import type { Provider } from "../domain/types";
import { noteServerTime } from "../state/server-clock";
import { BOOKING_ENDPOINTS as E } from "./endpoints";

function parse<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiError("Unexpected response shape", "invalid-response");
  return result.data;
}

const withNow = <T extends z.ZodRawShape>(shape: T) => z.object({ ...shape, now: z.string().optional() });
/** Every response that carries the server's clock keeps our offset to it fresh. */
const track = <T extends { now?: string }>(body: T): T => {
  if (body.now) noteServerTime(body.now);
  return body;
};

export interface ProviderData {
  provider: Provider;
  issues: ProviderIssue[];
}

export async function fetchProvider(providerId: number, signal?: AbortSignal): Promise<ProviderData> {
  const body = track(
    parse(withNow({ provider: z.unknown() }), await apiRequest({ endpoint: E.provider.id, path: `/api/providers/${providerId}`, signal })),
  );
  const normalized = normalizeProvider(body.provider);
  if (!normalized) throw new ApiError("Unreadable provider", "invalid-response");
  return normalized;
}

export async function fetchProviders(signal?: AbortSignal): Promise<ProviderData[]> {
  const body = parse(z.object({ data: z.array(z.unknown()) }), await apiRequest({ endpoint: E.providers.id, path: "/api/providers", signal }));
  return body.data.map((p) => normalizeProvider(p)).filter((p): p is ProviderData => p !== null);
}

const statusSchema = z.object({ kind: z.string() }).passthrough();

export interface Availability {
  days: { date: PlainDate; status: DayStatus }[];
  /** specialistId → first date with a bookable start (null: none in the window). */
  nextAvailable: Record<string, PlainDate | null>;
}

export async function fetchAvailability(
  providerId: number,
  options: { specialistId: string | null; people: number; exceptBooking?: string },
  signal?: AbortSignal,
): Promise<Availability> {
  const params = new URLSearchParams({ people: String(options.people) });
  if (options.specialistId) params.set("specialistId", options.specialistId);
  if (options.exceptBooking) params.set("exceptBooking", options.exceptBooking);
  const body = track(
    parse(
      withNow({
        days: z.array(z.object({ date: z.string(), status: statusSchema })),
        specialists: z.array(z.object({ specialistId: z.string(), nextAvailable: z.string().nullable() })),
      }),
      await apiRequest({ endpoint: E.availability.id, path: `/api/providers/${providerId}/availability?${params}`, signal }),
    ),
  );
  return {
    days: body.days as Availability["days"],
    nextAvailable: Object.fromEntries(body.specialists.map((s) => [s.specialistId, s.nextAvailable])),
  };
}

export interface ApiSlot {
  specialistId: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
}

export async function fetchSlots(
  providerId: number,
  date: PlainDate,
  specialistId: string | null,
  signal?: AbortSignal,
): Promise<ApiSlot[]> {
  const params = new URLSearchParams({ date });
  if (specialistId) params.set("specialistId", specialistId);
  const body = track(
    parse(
      withNow({
        slots: z.array(z.object({ specialistId: z.string(), startTime: z.string(), endTime: z.string(), isBooked: z.boolean() })),
      }),
      await apiRequest({ endpoint: E.slots.id, path: `/api/providers/${providerId}/slots?${params}`, signal }),
    ),
  );
  return body.slots;
}

export const bookingSchema = z.object({
  bookingId: z.string(),
  providerId: z.number(),
  specialistId: z.string(),
  date: z.string(),
  startTime: z.string(),
  numberOfPeople: z.number(),
  slotTimes: z.array(z.string()).optional(),
});
export type Booking = z.infer<typeof bookingSchema>;

export async function createBooking(request: {
  providerId: number;
  specialistId: string;
  date: PlainDate;
  startTime: string;
  numberOfPeople: number;
  idempotencyKey: string;
}): Promise<Booking> {
  const body = await apiRequest({
    endpoint: E.create.id,
    path: "/api/bookings",
    method: "POST",
    body: request,
    timeoutMs: 12_000,
  });
  return parse(z.object({ bookingId: z.string(), booking: bookingSchema }), body).booking;
}

export async function fetchBooking(bookingId: string, signal?: AbortSignal): Promise<Booking> {
  const body = await apiRequest({ endpoint: E.booking.id, path: `/api/bookings/${encodeURIComponent(bookingId)}`, signal });
  return parse(z.object({ booking: bookingSchema }), body).booking;
}

export async function moveBooking(bookingId: string, change: { date: PlainDate; startTime: string }): Promise<Booking> {
  const body = await apiRequest({
    endpoint: E.move.id,
    path: `/api/bookings/${encodeURIComponent(bookingId)}`,
    method: "PUT",
    body: change,
    timeoutMs: 12_000,
  });
  return parse(z.object({ booking: bookingSchema }), body).booking;
}

export async function resetDemo(): Promise<void> {
  await fetch("/api/demo/reset", { method: "POST" });
}
