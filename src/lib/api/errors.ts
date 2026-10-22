/**
 * Typed failures so the UI can tell the customer *what* went wrong:
 * "you're offline" reads very differently from "our server had a problem".
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: "http" | "network" | "timeout" | "offline" | "invalid-response",
    readonly status?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Worth retrying automatically: transient transport problems and 5xx. */
  get isTransient(): boolean {
    if (this.kind === "http") return (this.status ?? 0) >= 500;
    return this.kind !== "invalid-response";
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Customer-facing explanation. Never shows status codes or stack traces. */
export function describeApiError(error: unknown): { title: string; detail: string } {
  if (isApiError(error)) {
    switch (error.kind) {
      case "offline":
        return {
          title: "You're offline",
          detail: "Check your internet connection. We'll try again as soon as you're back online.",
        };
      case "network":
        return {
          title: "We couldn't reach MedEx",
          detail: "The connection dropped before we got a reply. Please try again.",
        };
      case "timeout":
        return {
          title: "This is taking too long",
          detail: "Our server didn't answer in time. Please try again.",
        };
      case "invalid-response":
        return {
          title: "Something went wrong on our side",
          detail: "We received data we couldn't read. Please try again in a moment.",
        };
      case "http":
        return {
          title: "Something went wrong on our side",
          detail: "Our server had a problem loading this. It's not something you did.",
        };
    }
  }
  return { title: "Something went wrong", detail: "Please try again." };
}
