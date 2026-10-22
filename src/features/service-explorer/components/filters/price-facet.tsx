"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { currencyName, formatCount, formatMoneyWhole, type CurrencyCode } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Facets } from "../../domain/engine";
import type { ExplorerFilters } from "../../domain/filters";
import { priceScale } from "../../domain/price-scale";
import type { Catalog } from "../../domain/types";
import { FacetSection } from "./facet-section";
import type { FilterChange } from "./types";

const ANY = "any";

/**
 * Price filtering across currencies.
 *
 * MedEx has no exchange rates, so a price range only makes sense inside one
 * currency. The customer picks the currency (with live counts); the range then
 * applies to services priced in it, and services in other currencies are hidden,
 * and the results say so. If the other filters already narrow the results to a
 * single currency (e.g. "Bangkok" → THB), the range inputs appear straight away
 * for it.
 */
export function PriceFacet({
  filters,
  facets,
  catalog,
  onChange,
}: {
  filters: ExplorerFilters;
  facets: Facets;
  catalog: Catalog;
  onChange: FilterChange;
}) {
  const available = catalog.currencies.filter((c) => (facets.currencies.get(c) ?? 0) > 0);
  const rangeCurrency =
    filters.currency ?? (available.length === 1 ? (available[0] ?? null) : null);
  const groupId = useId();

  const setCurrency = (value: string) =>
    onChange({
      ...filters,
      currency: value === ANY ? null : value,
      priceMin: null,
      priceMax: null,
      page: 1,
    });

  return (
    <FacetSection
      title="Price"
      onClear={
        filters.currency
          ? () => onChange({ ...filters, currency: null, priceMin: null, priceMax: null, page: 1 })
          : undefined
      }
      description={
        filters.currency
          ? `Showing only services priced in ${filters.currency}.`
          : "Prices aren't converted between currencies. Choose one to filter by price."
      }
    >
      <RadioGroup
        value={filters.currency ?? ANY}
        onValueChange={setCurrency}
        aria-label="Currency"
        className="mt-1 gap-0"
      >
        <CurrencyOption id={`${groupId}-any`} value={ANY} label="Any currency" />
        {catalog.currencies.map((code) => {
          const count = facets.currencies.get(code) ?? 0;
          return (
            <CurrencyOption
              key={code}
              id={`${groupId}-${code}`}
              value={code}
              label={
                <>
                  {currencyName(code)} <span className="text-muted-foreground">({code})</span>
                </>
              }
              count={count}
              disabled={count === 0 && filters.currency !== code}
            />
          );
        })}
      </RadioGroup>

      {rangeCurrency && (
        <PriceRange
          key={rangeCurrency}
          currency={rangeCurrency}
          filters={filters}
          samples={facets.priceSamples.get(rangeCurrency) ?? []}
          onChange={onChange}
        />
      )}
    </FacetSection>
  );
}

function CurrencyOption({
  id,
  value,
  label,
  count,
  disabled,
}: {
  id: string;
  value: string;
  label: React.ReactNode;
  count?: number;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-h-9 items-center gap-3 rounded-md px-2 hover:bg-muted/70 pointer-coarse:min-h-11">
      <RadioGroupItem id={id} value={value} disabled={disabled} />
      <Label
        htmlFor={id}
        className={cn(
          "flex flex-1 cursor-pointer items-center justify-between gap-2 py-1.5 font-normal",
          disabled && "cursor-not-allowed text-muted-foreground",
        )}
      >
        <span>{label}</span>
        {count !== undefined && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatCount(count)}
            <span className="sr-only"> results</span>
          </span>
        )}
      </Label>
    </div>
  );
}

const rangeSchema = z
  .object({
    min: z.string().trim().regex(/^\d*$/, "Use whole numbers, e.g. 1500"),
    max: z.string().trim().regex(/^\d*$/, "Use whole numbers, e.g. 5000"),
  })
  .refine(({ min, max }) => !min || !max || Number(min) <= Number(max), {
    message: "The maximum must be at least the minimum",
    path: ["max"],
  });

type RangeForm = z.infer<typeof rangeSchema>;

const toField = (value: number | null) => (value === null ? "" : String(value));
const fromField = (value: string) => (value.trim() === "" ? null : Number(value));

function PriceRange({
  currency,
  filters,
  samples,
  onChange,
}: {
  currency: CurrencyCode;
  filters: ExplorerFilters;
  samples: number[];
  onChange: FilterChange;
}) {
  const scale = useMemo(() => priceScale(samples), [samples]);
  const minId = useId();
  const maxId = useId();
  const errorId = useId();

  const form = useForm<RangeForm>({
    resolver: zodResolver(rangeSchema),
    defaultValues: { min: toField(filters.priceMin), max: toField(filters.priceMax) },
    mode: "onChange",
  });

  // Follow the URL when it changes elsewhere (back button, chip removed).
  useEffect(() => {
    form.reset({ min: toField(filters.priceMin), max: toField(filters.priceMax) });
  }, [filters.priceMin, filters.priceMax, form]);

  // While dragging, the slider shows its own value; it isn't committed yet.
  const [dragging, setDragging] = useState<[number, number] | null>(null);
  const committed: [number, number] = [filters.priceMin ?? 0, filters.priceMax ?? scale.max];
  const sliderValue = dragging ?? [
    Math.min(committed[0], scale.max),
    Math.min(committed[1], scale.max),
  ];

  const apply = (min: number | null, max: number | null) =>
    onChange({
      ...filters,
      currency,
      // The slider's ends mean "no limit"
      priceMin: min === 0 ? null : min,
      priceMax: max !== null && max >= scale.max ? null : max,
      page: 1,
    });

  const submit = form.handleSubmit(({ min, max }) => {
    const nextMin = fromField(min);
    const nextMax = fromField(max);
    if (nextMin === filters.priceMin && nextMax === filters.priceMax) return;
    onChange({ ...filters, currency, priceMin: nextMin, priceMax: nextMax, page: 1 });
  });

  const errors = form.formState.errors;
  const error = errors.min?.message ?? errors.max?.message;
  const tallest = Math.max(1, ...scale.histogram);

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div aria-hidden className="flex h-12 items-end gap-px px-2">
        {scale.histogram.map((count, i) => {
          const start = (i / scale.histogram.length) * scale.max;
          const end = ((i + 1) / scale.histogram.length) * scale.max;
          const inside = end > sliderValue[0] && start < sliderValue[1];
          return (
            <div
              key={i}
              className={cn(
                "flex-1 rounded-t-sm transition-colors",
                inside ? "bg-primary/60" : "bg-muted-foreground/20",
              )}
              style={{ height: `${count === 0 ? 0 : Math.max(8, (count / tallest) * 100)}%` }}
            />
          );
        })}
      </div>
      <Slider
        className="px-2"
        min={0}
        max={scale.max}
        step={scale.step}
        minStepsBetweenThumbs={0}
        value={sliderValue}
        thumbLabels={[`Minimum price in ${currency}`, `Maximum price in ${currency}`]}
        onValueChange={(value) => {
          const [min = 0, max = scale.max] = value;
          setDragging([min, max]);
          form.setValue("min", min === 0 ? "" : String(min));
          form.setValue("max", max >= scale.max ? "" : String(max));
        }}
        onValueCommit={(value) => {
          setDragging(null);
          apply(value[0] ?? 0, value[1] ?? scale.max);
        }}
      />
      <form
        className="grid grid-cols-2 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        noValidate
      >
        <RangeInput
          id={minId}
          label="Min"
          currency={currency}
          placeholder="0"
          invalid={Boolean(errors.min)}
          errorId={errorId}
          {...form.register("min", { onBlur: () => void submit() })}
        />
        <RangeInput
          id={maxId}
          label="Max"
          currency={currency}
          placeholder={`${formatCount(scale.max)}+`}
          invalid={Boolean(errors.max)}
          errorId={errorId}
          {...form.register("max", { onBlur: () => void submit() })}
        />
        {/* Enter in either field applies the range */}
        <button type="submit" className="sr-only" tabIndex={-1}>
          Apply price range
        </button>
      </form>
      <p
        id={errorId}
        className={cn("min-h-4 text-xs", error ? "text-destructive" : "text-muted-foreground")}
        aria-live="polite"
      >
        {error ??
          `Final prices incl. charges. Up to ${formatMoneyWhole(scale.max, currency)} with your other filters.`}
      </p>
    </div>
  );
}

const RangeInput = function RangeInput({
  id,
  label,
  currency,
  invalid,
  errorId,
  ...props
}: {
  id: string;
  label: string;
  currency: CurrencyCode;
  invalid: boolean;
  errorId: string;
} & React.ComponentProps<"input">) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label} ({currency})
      </Label>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={invalid}
        aria-describedby={errorId}
        className="h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-base tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 pointer-coarse:h-11"
        {...props}
      />
    </div>
  );
};
