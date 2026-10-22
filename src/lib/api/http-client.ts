import { MOCK_FAIL_HEADER, MOCK_LATENCY_HEADER } from "@/lib/mock-controls/protocol";
import { useMockControls } from "@/lib/mock-controls/store";
import { ApiError } from "./errors";

export interface ApiRequest {
  /** Id of the mock endpoint, used to look up dev-panel failure rules. */
  endpoint: string;
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** The client gives up after this long and reports a timeout. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Thin fetch wrapper: JSON in/out, typed errors, timeouts, and the dev-panel
 * hooks for injecting latency and failures. Response bodies are returned as
 * `unknown`; each feature validates and maps them at its own boundary.
 */
export async function apiRequest(request: ApiRequest): Promise<unknown> {
  const controls = useMockControls.getState();

  if (controls.simulateOffline || (typeof navigator !== "undefined" && !navigator.onLine)) {
    throw new ApiError("Browser is offline", "offline");
  }

  const headers = new Headers(request.headers);
  headers.set("accept", "application/json");
  headers.set(MOCK_LATENCY_HEADER, controls.latency);
  if (request.body !== undefined) headers.set("content-type", "application/json");

  const failure = controls.takeFailure(request.endpoint);
  if (failure === "network") {
    // The request "never arrives": wait a moment so it feels like a real drop.
    await delay(400, request.signal);
    throw new ApiError("Simulated network failure", "network");
  }
  if (failure !== null) headers.set(MOCK_FAIL_HEADER, String(failure));

  const timeout = AbortSignal.timeout(request.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(request.path, {
      method: request.method ?? "GET",
      headers,
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      signal,
    });
  } catch (error) {
    if (request.signal?.aborted) throw error; // caller cancelled: not an API failure
    if (timeout.aborted) throw new ApiError("Request timed out", "timeout");
    throw new ApiError("Network request failed", "network");
  }

  const body = await readBody(response);
  if (!response.ok) {
    throw new ApiError(`HTTP ${response.status}`, "http", response.status, body);
  }
  return body;
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError("Response was not JSON", "invalid-response", response.status);
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
