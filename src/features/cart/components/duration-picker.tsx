"use client";

import { ClockIcon } from "lucide-react";
import { useId } from "react";
import { NativeRadio } from "@/components/form/native-checkbox";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { durationLabel } from "../domain/labels";
import type { LineView } from "../domain/types";

/**
 * Wellness treatments are priced by duration, so the customer must choose
 * one before the group can be checked out. Until then the price is shown as
 * unknown, never as zero.
 */
export function DurationPicker({
  line,
  disabled,
  onChoose,
}: {
  line: LineView;
  disabled?: boolean;
  onChoose: (optionId: string) => void;
}) {
  const name = useId();
  const product = line.product!;
  const missing = !line.chosenOption;
  return (
    <fieldset
      className={cn("rounded-lg border p-3", missing && "border-warning bg-warning-muted/60")}
    >
      <legend className="flex items-center gap-1.5 px-1 text-sm font-medium">
        <ClockIcon aria-hidden className="size-4" />
        {missing ? "Choose a duration to see the price" : "Duration"}
      </legend>
      <div className="flex flex-wrap gap-2">
        {product.wellnessOptions.map((option) => {
          const id = `${name}-${option.id}`;
          const checked = line.wellnessPricingId === option.id;
          return (
            <label
              key={option.id}
              htmlFor={id}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:border-primary/60",
                checked && "border-primary bg-accent",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <NativeRadio
                id={id}
                name={name}
                checked={checked}
                disabled={disabled}
                onChange={() => onChoose(option.id)}
              />
              <span className="font-medium">{durationLabel(option.durationMinutes)}</span>
              <span className="text-muted-foreground tabular-nums">
                {formatMoney(option.price, product.currency)}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
