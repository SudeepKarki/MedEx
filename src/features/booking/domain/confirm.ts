import { isApiError } from "@/lib/api/errors";

/**
 * What a failed confirm means for the customer:
 * - taken:    someone else got the slot (409); nothing was booked
 * - failed:   the server answered that it didn't make the booking; safe to try again
 * - unknown:  no answer (dropped connection, timeout, unreadable reply), so it
 *             MAY have been booked. Nothing new can be confirmed until we've checked.
 */
export type ConfirmFailure =
  | { kind: "taken"; message: string }
  | { kind: "failed"; message: string }
  | { kind: "unknown"; message: string };

function serverMessage(body: unknown): string | null {
  if (body && typeof body === "object" && "message" in body && typeof body.message === "string") return body.message;
  return null;
}

export function classifyConfirmFailure(error: unknown): ConfirmFailure {
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
        message: "The connection dropped before the hospital's system replied, so we don't know yet whether it went through.",
      };
    case "http":
      if (error.status === 409) {
        return { kind: "taken", message: serverMessage(error.body) ?? "Someone else booked this time a moment ago." };
      }
      if ((error.status ?? 0) >= 500) {
        return { kind: "failed", message: "Our booking system had a problem and nothing was booked. Please try again." };
      }
      return { kind: "failed", message: serverMessage(error.body) ?? "That booking couldn't be made. Please choose again." };
  }
}
