const NICE_MAX = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
const NICE_STEP = [1, 2, 5, 10];

function roundUpTo(value: number, nice: readonly number[]): number {
  if (value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return (nice.find((n) => n * magnitude >= value) ?? 10) * magnitude;
}

/** Rounds up to a "nice" slider maximum: 24,950 → 25,000; 25,893 → 30,000. */
export function niceCeil(value: number): number {
  return roundUpTo(value, NICE_MAX);
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
  // Whole currency units only: the URL stores whole numbers, so a fractional
  // step would produce prices the URL then drops.
  const step = Math.max(1, Math.round(roundUpTo(max / 200, NICE_STEP)));
  const histogram = new Array<number>(buckets).fill(0);
  for (const minor of samplesMinor) {
    const i = Math.min(buckets - 1, Math.floor((minor / 100 / max) * buckets));
    histogram[i]! += 1;
  }
  return { max, step, histogram };
}
