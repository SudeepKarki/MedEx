const NICE = [1, 2, 2.5, 5, 10];

/** Rounds up to a "nice" number (1, 2, 2.5 or 5 × 10ⁿ): 24,950 → 25,000. */
export function niceCeil(value: number): number {
  if (value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const nice = NICE.find((n) => n * magnitude >= value) ?? 10;
  return nice * magnitude;
}

export interface PriceScale {
  /** Upper bound of the slider, whole currency units. */
  max: number;
  step: number;
  /** Count of services per equal-width bucket from 0 to max. */
  histogram: number[];
}

/**
 * Builds the slider scale and histogram for one currency from the cheapest
 * price of each service passing every other filter (minor units).
 */
export function priceScale(samplesMinor: readonly number[], buckets = 24): PriceScale {
  const highest = samplesMinor.reduce((max, m) => Math.max(max, m), 0) / 100;
  const max = Math.max(niceCeil(highest), 100);
  const step = Math.max(1, niceCeil(max / 200));
  const histogram = new Array<number>(buckets).fill(0);
  for (const minor of samplesMinor) {
    const i = Math.min(buckets - 1, Math.floor((minor / 100 / max) * buckets));
    histogram[i]! += 1;
  }
  return { max, step, histogram };
}
