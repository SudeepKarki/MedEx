"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useRegisterDevActions } from "@/lib/mock-controls/dev-actions";
import { useRegisterMockEndpoints } from "@/lib/mock-controls/use-register-mock-endpoints";
import { resetDemo } from "../api/client";
import { BOOKING_ENDPOINT_LIST } from "../api/endpoints";
import { useConfirmAttempts } from "../state/confirm-attempt";
import { bookingKeys } from "./queries";

/** Lists the booking endpoints in the Mock API panel and adds "Reset demo bookings". */
export function useBookingDevTools() {
  useRegisterMockEndpoints(BOOKING_ENDPOINT_LIST);
  const queryClient = useQueryClient();
  useRegisterDevActions(
    useMemo(
      () => [
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
      ],
      [queryClient],
    ),
  );
}
