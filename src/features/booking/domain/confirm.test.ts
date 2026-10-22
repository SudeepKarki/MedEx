import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { classifyConfirmFailure } from "./confirm";

describe("classifyConfirmFailure", () => {
  it("treats a 409 as taken and keeps the server's explanation", () => {
    const error = new ApiError("HTTP 409", "http", 409, { message: "Someone else booked 10:40 AM a moment ago." });
    expect(classifyConfirmFailure(error)).toEqual({ kind: "taken", message: "Someone else booked 10:40 AM a moment ago." });
  });

  it("treats a dropped connection or timeout as unknown: it may have been booked", () => {
    expect(classifyConfirmFailure(new ApiError("x", "network")).kind).toBe("unknown");
    expect(classifyConfirmFailure(new ApiError("x", "timeout")).kind).toBe("unknown");
    expect(classifyConfirmFailure(new ApiError("x", "invalid-response", 200)).kind).toBe("unknown");
  });

  it("treats a 500 or being offline as a definite failure (nothing was booked)", () => {
    expect(classifyConfirmFailure(new ApiError("x", "http", 500)).kind).toBe("failed");
    expect(classifyConfirmFailure(new ApiError("x", "offline")).kind).toBe("failed");
  });
});
