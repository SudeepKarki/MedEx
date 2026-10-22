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
 * - any other string: an endpoint-specific scenario the route handler
 *   implements itself (e.g. "declined-later": a payment that fails after
 *   the order was accepted). Unknown values are ignored by other endpoints.
 */
export type FailureKind = number | "network" | "timeout" | (string & {});

/**
 * - "once": the next call fails, then the endpoint works again
 * - "second": the next call works, the one after fails (e.g. "the second
 *   of three orders fails"), then it works again
 * - "always": every call fails until switched off
 */
export type FailureMode = "off" | "once" | "second" | "always";

export interface EndpointRule {
  mode: FailureMode;
  kind: FailureKind;
  /** Calls still to let through before a "second" rule fires. */
  skip?: number;
}

export interface MockEndpointDefinition {
  /** Stable id used by the client to look up its rule, e.g. "services.list". */
  id: string;
  /** Human-readable label for the dev panel, e.g. "GET /api/services". */
  label: string;
  /** Failure kinds that make sense for this endpoint; the first is the default. */
  failureKinds: readonly FailureKind[];
}

const FAILURE_KIND_LABELS: Record<string, string> = {
  network: "Network error",
  timeout: "Timeout",
  "declined-later": "Payment fails after processing",
  "lost-response": "Order placed, reply lost",
};

export function describeFailureKind(kind: FailureKind): string {
  if (typeof kind === "number") return `HTTP ${kind}`;
  return FAILURE_KIND_LABELS[kind] ?? kind;
}
