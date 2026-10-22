import "server-only";

import {
  DEFAULT_LATENCY,
  LATENCY_PRESETS,
  MOCK_FAIL_HEADER,
  MOCK_FAIL_QUERY,
  MOCK_LATENCY_HEADER,
  MOCK_LATENCY_QUERY,
  isLatencyPreset,
} from "@/lib/mock-controls/protocol";

/** Longer than the client's 15 s timeout, so "timeout" failures really time out. */
const TIMEOUT_HOLD_MS = 20_000;

interface MockOptions {
  /** Extra latency for heavy endpoints, added on top of the preset. */
  extraLatencyMs?: number;
}

/**
 * Wraps a route handler with artificial latency and on-demand failures.
 *
 * Latency comes from `x-mock-latency` (a preset name or milliseconds) or the
 * `_latency` query flag; failure from `x-mock-fail` / `_fail` (an HTTP status
 * or "timeout"). Without either, the endpoint behaves like a realistic,
 * healthy server. Reading the request also keeps the handler dynamic under
 * Cache Components, which is what a mock of a live API should be.
 */
export async function withMockControls(
  request: Request,
  handler: () => Response | Promise<Response>,
  options: MockOptions = {},
): Promise<Response> {
  const { failure } = readMockControls(request);

  if (failure === "timeout") {
    await holdUntilClientGivesUp(request);
    return Response.json({ message: "Simulated timeout" }, { status: 504 });
  }

  await mockDelay(request, options.extraLatencyMs);

  const status = failure ? Number(failure) : NaN;
  if (Number.isInteger(status) && status >= 400 && status <= 599) {
    return Response.json(
      { code: "SIMULATED", message: `Simulated failure (HTTP ${status})` },
      { status },
    );
  }

  return handler();
}

/** The mock controls a request carries, for handlers that implement failures themselves. */
export function readMockControls(request: Request): {
  latency: string | null;
  failure: string | null;
} {
  const url = new URL(request.url);
  return {
    latency: request.headers.get(MOCK_LATENCY_HEADER) ?? url.searchParams.get(MOCK_LATENCY_QUERY),
    failure: request.headers.get(MOCK_FAIL_HEADER) ?? url.searchParams.get(MOCK_FAIL_QUERY),
  };
}

/** Waits the requested (or default realistic) latency. */
export function mockDelay(request: Request, extraMs = 0): Promise<void> {
  return sleep(resolveLatency(readMockControls(request).latency) + extraMs, request.signal);
}

/** Holds the request past the client's timeout (or until the client gives up). */
export function holdUntilClientGivesUp(request: Request): Promise<void> {
  return sleep(TIMEOUT_HOLD_MS, request.signal);
}

function resolveLatency(value: string | null): number {
  if (value && /^\d+$/.test(value)) return Math.min(Number(value), 30_000);
  const preset = value && isLatencyPreset(value) ? value : DEFAULT_LATENCY;
  const [min, max] = LATENCY_PRESETS[preset].range;
  return min + Math.random() * (max - min);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    // Client gave up: stop waiting, the response will be discarded anyway.
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
