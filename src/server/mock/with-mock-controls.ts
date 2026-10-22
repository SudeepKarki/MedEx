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
  const url = new URL(request.url);
  const latencyValue =
    request.headers.get(MOCK_LATENCY_HEADER) ?? url.searchParams.get(MOCK_LATENCY_QUERY);
  const failValue = request.headers.get(MOCK_FAIL_HEADER) ?? url.searchParams.get(MOCK_FAIL_QUERY);

  if (failValue === "timeout") {
    await sleep(TIMEOUT_HOLD_MS, request.signal);
    return Response.json({ message: "Simulated timeout" }, { status: 504 });
  }

  await sleep(resolveLatency(latencyValue) + (options.extraLatencyMs ?? 0), request.signal);

  const status = failValue ? Number(failValue) : NaN;
  if (Number.isInteger(status) && status >= 400 && status <= 599) {
    return Response.json(
      { message: `Simulated failure (HTTP ${status})`, simulated: true },
      { status },
    );
  }

  return handler();
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
