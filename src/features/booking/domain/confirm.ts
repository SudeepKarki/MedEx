import { isApiError } from "@/lib/api/errors";

/**
 * What a failed confirm means for the customer:
 * - taken:    someone else got the slot (409); nothing was booked
 * - failed:   the server answered that it didn't make the booking; safe to try again
 * - unknown:  no answer (dropped connection, timeout, unreadable reply), so it
 *             MAY have been booked. Nothing new can be confirmed until we've checked.
 */
export type ConfirmFailure =
  /** `unavailable`: not taken by someone, but no longer bookable (it started, say). */
  | { kind: "taken"; message: string; unavailable: boolean }
  | { kind: "failed"; message: string }
  | { kind: "unknown"; message: string };

function serverCode(body: unknown): string | null {
  if (body && typeof body === "object" && "code" in body && typeof body.code === "string") return body.code;
  return null;
}

function serverMessage(body: unknown): string | null {
  if (body && typeof body === "object" && "message" in body && typeof body.message === "string") return body.message;
  return null;
}

/**
 * `uncertain`: an earlier send of this same request was never answered, so it
 * may already have been booked. Then only a definitive answer settles it (a
 * 4xx: the server decided); a 500 or being offline leaves it unknown.
 */
export function classifyConfirmFailure(error: unknown, { uncertain = false } = {}): ConfirmFailure {
  const result = classify(error);
  const definitive = isApiError(error) && error.kind === "http" && (error.status ?? 0) < 500;
  if (uncertain && result.kind === "failed" && !definitive) {
    return {
      kind: "unknown",
      message: "We still couldn't find out whether your earlier request went through, so nothing new can be booked yet.",
    };
  }
  return result;
}

function classify(error: unknown): ConfirmFailure {
  if (!isApiError(error)) {
    return { kind: "unknown", message: "Something unexpected happened, so we can't tell yet whether it went through." };
  }
  switch (error.kind) {
    case "offline":
      // Thrown before sending: the request never left the device
      return { kind: "failed", message: "You're offline, so nothing was sent. Reconnect and try again." };
    case "network":
    case "timeout":
    case "invalid-response":
      return {
        kind: "unknown",
        message: "The connection dropped before the booking system replied, so we don't know yet whether it went through.",
      };
    case "http":
      if (error.status === 409) {
        return {
          kind: "taken",
          message: serverMessage(error.body) ?? "Someone else booked this time a moment ago.",
          unavailable: serverCode(error.body) === "SLOT_UNAVAILABLE",
        };
      }
      if ((error.status ?? 0) >= 500) {
        return { kind: "failed", message: "Our booking system had a problem and nothing was booked. Please try again." };
      }
      return { kind: "failed", message: serverMessage(error.body) ?? "That booking couldn't be made. Please choose again." };
  }
}
