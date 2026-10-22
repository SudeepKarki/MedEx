import type { MockEndpointDefinition } from "@/lib/mock-controls/protocol";

export const BOOKING_ENDPOINTS = {
  providers: { id: "booking.providers", label: "GET /api/providers", failureKinds: [500, "network", "timeout"] },
  provider: { id: "booking.provider", label: "GET /api/providers/:id", failureKinds: [500, "network", "timeout"] },
  availability: {
    id: "booking.availability",
    label: "GET /api/providers/:id/availability",
    failureKinds: [500, "network", "timeout"],
  },
  slots: { id: "booking.slots", label: "GET /api/providers/:id/slots", failureKinds: [500, "network", "timeout"] },
  create: {
    id: "booking.create",
    label: "POST /api/bookings",
    failureKinds: [409, "lost-response", 500, "network", "timeout"],
    kindLabels: { "lost-response": "Booking made, reply lost" },
  },
  move: { id: "booking.move", label: "PUT /api/bookings/:id", failureKinds: [409, 500, "network"] },
  booking: { id: "booking.get", label: "GET /api/bookings/:id", failureKinds: [500, "network"] },
} as const satisfies Record<string, MockEndpointDefinition>;

/** The fixture's `existingBooking`: where the reschedule demo starts. */
export const DEMO_BOOKING_ID = "BK-20261008-0042";

export const BOOKING_ENDPOINT_LIST: readonly MockEndpointDefinition[] = Object.values(BOOKING_ENDPOINTS);
