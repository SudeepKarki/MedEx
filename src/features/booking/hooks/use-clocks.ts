"use client";

import { useIsClient } from "@/hooks/use-is-client";
import type { PlainDate } from "../domain/plain-date";
import { providerZoneLabel, sameClock, zoneCity, type Zone } from "../domain/timezone";
import { dualTime, type DualTime } from "../domain/two-clocks";
import type { Provider } from "../domain/types";
import { useCustomerZone } from "../state/customer-zone";
import { useServerMinute } from "../state/server-clock";

export interface Clocks {
  provider: Zone;
  customer: Zone;
  /** What to call the provider's clock: "Thailand" (as in "Thailand time"). */
  providerLabel: string;
  /** The customer's zone, by its city: "Kathmandu". */
  customerLabel: string;
  /** The customer's clock reads the same as the provider's right now: one clock is enough. */
  same: boolean;
  /** The customer's zone came from the device (not chosen by hand). */
  detected: boolean;
  /** The current minute by the server's clock (0 until known on the client). */
  minute: number;
  dual: (date: PlainDate, minutes: number) => DualTime;
}

/** Both clocks for a provider: theirs (where the appointment is) and the customer's. */
export function useClocks(provider: Provider): Clocks {
  const isClient = useIsClient();
  const { zone: customer, detected } = useCustomerZone(isClient);
  const minute = useServerMinute();
  const providerZone = provider.timeZone.zone;
  return {
    provider: providerZone,
    customer,
    providerLabel: providerZoneLabel(providerZone, provider.country),
    customerLabel: zoneCity(customer),
    same: sameClock(providerZone, customer, minute * 60_000),
    detected,
    minute,
    dual: (date, minutes) => dualTime(providerZone, customer, date, minutes),
  };
}
