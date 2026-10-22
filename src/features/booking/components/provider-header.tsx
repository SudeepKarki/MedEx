import { InfoIcon, MapPinIcon } from "lucide-react";
import type { ResolvedZone } from "../domain/timezone";
import { formatOffset, offsetMinutes, zoneCity } from "../domain/timezone";
import type { Provider } from "../domain/types";

const COUNTRY_NAMES: Record<string, string> = { TH: "Thailand", NP: "Nepal", IN: "India" };

/**
 * The provider typed its time zone by hand. Where we had to interpret it,
 * say so in plain words, so a customer can spot it if we read it wrong.
 */
export function zoneDisclosure(resolved: ResolvedZone, now: number): string | null {
  const city = zoneCity(resolved.zone);
  const offset = formatOffset(offsetMinutes(resolved.zone, now));
  const typed = resolved.input.trim();
  switch (resolved.source) {
    case "iana":
      return null;
    case "offset":
    case "windows":
      return `Their time zone is listed as “${typed}”, which we read as ${city} time (${offset}).`;
    case "country":
      return typed
        ? `We couldn't read their time zone (“${typed}”), so we're using ${city} time (${offset}), from their country.`
        : `They haven't listed a time zone, so we're using ${city} time (${offset}), from their country.`;
  }
}

export function ProviderHeader({
  provider,
  title,
  eyebrow,
  now,
}: {
  provider: Provider;
  title: string;
  eyebrow?: string;
  /** Server time in ms (0 until known). */
  now: number;
}) {
  // Offsets need a real moment (Nepal was UTC+5:30 before 1986), so wait for the clock
  const disclosure = now > 0 ? zoneDisclosure(provider.timeZone, now) : null;
  const country = provider.country ? (COUNTRY_NAMES[provider.country] ?? provider.country) : null;
  return (
    <header className="flex flex-col gap-1.5">
      {eyebrow && <p className="text-sm font-medium text-primary">{eyebrow}</p>}
      <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <MapPinIcon aria-hidden className="size-4" />
        {provider.name}
        {country && ` · ${zoneCity(provider.timeZone.zone)}, ${country}`}
      </p>
      {disclosure && (
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          {disclosure}
        </p>
      )}
    </header>
  );
}
