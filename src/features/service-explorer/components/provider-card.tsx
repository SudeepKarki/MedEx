"use client";

import { ChevronDownIcon, MapPinIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { formatCount } from "@/lib/money";
import type { ProviderResult } from "../domain/engine";
import { pluralize } from "../domain/labels";
import type { Catalog } from "../domain/types";
import { MAX_COMPARE, useCompare } from "../state/compare-store";
import { ProviderAvatar } from "./provider-avatar";
import { ProviderRating } from "./provider-rating";
import { ServiceRow } from "./service-row";

export const SERVICES_PREVIEW_COUNT = 3;

interface ProviderCardProps {
  result: ProviderResult;
  catalog: Catalog;
  rangeActive: boolean;
}

export function ProviderCard({ result, catalog, rangeActive }: ProviderCardProps) {
  const { provider, services } = result;
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const headingId = useId();
  const firstExtraRef = useRef<HTMLLIElement>(null);
  const visible = expanded ? services : services.slice(0, SERVICES_PREVIEW_COUNT);
  const hiddenCount = services.length - SERVICES_PREVIEW_COUNT;

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    // Move focus to the first newly revealed service so keyboard and screen
    // reader users land on what they asked to see.
    if (next) requestAnimationFrame(() => firstExtraRef.current?.focus());
  };

  return (
    <article
      aria-labelledby={headingId}
      className="flex flex-col rounded-xl border bg-card text-card-foreground shadow-xs"
    >
      <header className="flex flex-col gap-1.5 p-4 pb-2 sm:p-5 sm:pb-2">
        <div className="flex items-center gap-3">
          <ProviderAvatar id={provider.id} name={provider.name} />
          <h3
            id={headingId}
            className="min-w-0 flex-1 font-heading text-lg leading-tight font-semibold text-balance"
          >
            {provider.name}
          </h3>
          <CompareToggle providerId={provider.id} providerName={provider.name} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground sm:pl-14">
          <ProviderRating provider={provider} />
          {provider.city && provider.country && (
            <span className="inline-flex items-center gap-1">
              <MapPinIcon aria-hidden className="size-3.5" />
              {provider.city.name}, {provider.country.name}
            </span>
          )}
          {provider.currency && <span>Prices in {provider.currency}</span>}
        </div>
      </header>

      <p className="px-4 text-sm font-medium text-muted-foreground sm:px-5">
        {formatCount(services.length)} matching {pluralize(services.length, "service")}
      </p>

      <ul id={listId} className="divide-y px-4 sm:px-5">
        {visible.map((service, i) => (
          <li
            key={service.service.id}
            ref={i === SERVICES_PREVIEW_COUNT ? firstExtraRef : undefined}
            tabIndex={i === SERVICES_PREVIEW_COUNT ? -1 : undefined}
            className="outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ServiceRow
              result={service}
              catalog={catalog}
              currency={provider.currency}
              rangeActive={rangeActive}
            />
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && (
        <div className="border-t px-2 py-1.5 sm:px-3">
          <Button
            variant="ghost"
            className="w-full justify-center text-primary"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={toggle}
          >
            {expanded ? "Show fewer" : `View all ${formatCount(services.length)} matching services`}
            <ChevronDownIcon
              aria-hidden
              className={expanded ? "rotate-180 transition-transform" : "transition-transform"}
            />
          </Button>
        </div>
      )}
    </article>
  );
}

function CompareToggle({ providerId, providerName }: { providerId: number; providerName: string }) {
  const selected = useCompare((s) => s.providerIds.includes(providerId));
  const full = useCompare((s) => s.providerIds.length >= MAX_COMPARE);
  const toggle = useCompare((s) => s.toggle);
  const id = useId();
  const disabled = !selected && full;
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Checkbox
        id={id}
        checked={selected}
        disabled={disabled}
        onCheckedChange={() => toggle(providerId)}
        aria-describedby={disabled ? `${id}-full` : undefined}
      />
      <Label htmlFor={id} className="text-sm font-normal">
        Compare<span className="sr-only"> {providerName}</span>
      </Label>
      {disabled && (
        <span id={`${id}-full`} className="sr-only">
          You can compare up to {MAX_COMPARE} providers. Remove one first.
        </span>
      )}
    </div>
  );
}
