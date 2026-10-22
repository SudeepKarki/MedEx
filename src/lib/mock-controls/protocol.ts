/**
 * The contract between the client-side dev panel and the server-side mock API.
 *
 * The client sends these headers; route handlers read them (or the equivalent
 * `_latency` / `_fail` query flags, handy with curl). Nothing here exists in the
 * real MedEx API: it's how we make a specific call slow or fail on demand.
 */
export const MOCK_LATENCY_HEADER = "x-mock-latency";
export const MOCK_FAIL_HEADER = "x-mock-fail";
export const MOCK_LATENCY_QUERY = "_latency";
export const MOCK_FAIL_QUERY = "_fail";

export const LATENCY_PRESETS = {
  instant: { label: "Instant", range: [0, 0] },
  fast: { label: "Fast", range: [80, 200] },
  realistic: { label: "Realistic", range: [350, 900] },
  slow: { label: "Slow 3G", range: [2500, 4000] },
  "very-slow": { label: "Very slow", range: [8000, 10000] },
} as const satisfies Record<string, { label: string; range: readonly [number, number] }>;

export type LatencyPreset = keyof typeof LATENCY_PRESETS;

export const DEFAULT_LATENCY: LatencyPreset = "realistic";

export function isLatencyPreset(value: string): value is LatencyPreset {
  return Object.hasOwn(LATENCY_PRESETS, value);
}

/**
 * How an endpoint fails when failure is switched on:
 * - a number: the server answers with that HTTP status
 * - "network": the request never reaches the server (simulated in the client)
 * - "timeout": the server holds the request longer than the client waits
 */
export type FailureKind = number | "network" | "timeout";

export type FailureMode = "off" | "once" | "always";

export interface EndpointRule {
  mode: FailureMode;
  kind: FailureKind;
}

export interface MockEndpointDefinition {
  /** Stable id used by the client to look up its rule, e.g. "services.list". */
  id: string;
  /** Human-readable label for the dev panel, e.g. "GET /api/services". */
  label: string;
  /** Failure kinds that make sense for this endpoint; the first is the default. */
  failureKinds: readonly FailureKind[];
}

export function describeFailureKind(kind: FailureKind): string {
  if (kind === "network") return "Network error";
  if (kind === "timeout") return "Timeout";
  return `HTTP ${kind}`;
}
