"use client";

import { useId } from "react";
import { formatOffset, offsetMinutes, zoneCity } from "../domain/timezone";
import { deviceZoneId, useCustomerZoneStore } from "../state/customer-zone";

const SUGGESTED = ["Asia/Kathmandu", "Asia/Bangkok", "Asia/Kolkata", "Asia/Dubai", "Europe/London", "America/New_York", "Australia/Sydney"];

function allZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return SUGGESTED;
  }
}

function optionLabel(id: string, at: number) {
  const city = zoneCity({ kind: "iana", id });
  return `${city} (${formatOffset(offsetMinutes({ kind: "iana", id }, at))})${id.includes("/") ? ` · ${id.split("/")[0]}` : ""}`;
}

/**
 * "Your time zone": detected from the device, changeable for someone planning
 * from elsewhere. A native select: ~400 options, fully keyboard and
 * screen-reader friendly, and type-to-search for free.
 */
export function TimeZoneSelect({ now }: { now: number }) {
  const id = useId();
  const chosen = useCustomerZoneStore((s) => s.chosen);
  const setChosen = useCustomerZoneStore((s) => s.setChosen);
  const device = deviceZoneId();
  const zones = allZones();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        Your time zone
      </label>
      <select
        id={id}
        value={chosen ?? ""}
        // Applies as you go (arrow keys change a closed select in some browsers), never closes on its own
        onChange={(event) => setChosen(event.target.value || null)}
        className="h-11 w-full cursor-pointer rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">This device: {optionLabel(device, now)}</option>
        <optgroup label="Common">
          {SUGGESTED.map((zone) => (
            <option key={zone} value={zone}>
              {optionLabel(zone, now)}
            </option>
          ))}
        </optgroup>
        <optgroup label="All time zones">
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {optionLabel(zone, now)}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}
