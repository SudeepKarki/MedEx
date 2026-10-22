"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";

/**
 * −/+ with the value in between. Each press updates the screen immediately;
 * saving happens behind the scenes (see line-sync). The value is a polite
 * live region so screen-reader users hear the new quantity.
 */
export function QuantityStepper({
  label,
  value,
  max,
  disabled,
  onChange,
}: {
  /** e.g. "CBC Profile", used in the buttons' names */
  label: string;
  value: number;
  max: number | null;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  const atMax = max !== null && value >= max;
  const maxId = useId();
  return (
    <div
      role="group"
      aria-label={`Quantity of ${label}`}
      className="flex items-center rounded-lg border"
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Remove one ${label}`}
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <MinusIcon aria-hidden />
      </Button>
      <output aria-live="polite" className="min-w-8 text-center font-medium tabular-nums">
        {value}
      </output>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Add one more ${label}`}
        aria-describedby={atMax ? maxId : undefined}
        disabled={disabled || atMax}
        onClick={() => onChange(value + 1)}
      >
        <PlusIcon aria-hidden />
      </Button>
      {atMax && (
        <span id={maxId} className="sr-only">
          Maximum quantity reached
        </span>
      )}
    </div>
  );
}
